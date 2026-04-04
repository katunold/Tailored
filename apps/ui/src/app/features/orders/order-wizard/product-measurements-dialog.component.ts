import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, finalize, of } from 'rxjs';
import { MeasurementFieldDto, MeasurementsService } from '../../clients/measurements.service';
import { OrderItemType } from '../orders.service';

type DialogData = {
  itemTypes: OrderItemType[];
  profileValuesByItemType: Record<number, Record<string, number | string>>;
  draftValuesByItemType?: Record<number, Record<string, number | string>>;
  initialUseCurrentMeasurementsByItemType?: Record<number, boolean>;
  initialOrderDetailsByItemType?: Record<number, { color?: string | null; material?: string | null }>;
  initialItemTypeId?: number | null;
  lockItemTypeSelection?: boolean;
};

export type ProductMeasurementsDialogResult = {
  itemTypeId: number;
  itemTypeName: string;
  fields: MeasurementFieldDto[];
  values: Record<string, number | string>;
  useCurrentMeasurements: boolean;
  color?: string;
  material?: string;
};

@Component({
  selector: 'app-product-measurements-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title>Add Product Measurements</h2>
    <mat-dialog-content>
      <form [formGroup]="headerForm" class="dialog-grid">
        <mat-form-field appearance="outline" class="span-all">
          <mat-label>Select Product</mat-label>
          <mat-select formControlName="itemTypeId" [disabled]="data.lockItemTypeSelection === true">
            @for (itemType of data.itemTypes; track itemType.id) {
              <mat-option [value]="itemType.id">{{ itemType.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (selectedItemTypeId) {
          <mat-form-field appearance="outline">
            <mat-label>Color (Optional)</mat-label>
            <input matInput formControlName="color" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Material (Optional)</mat-label>
            <input matInput formControlName="material" />
          </mat-form-field>
        }
      </form>

      @if (isLoadingFields) {
        <section class="loading-state">
          <mat-spinner diameter="28"></mat-spinner>
          <p>Loading measurements...</p>
        </section>
      } @else if (selectedItemTypeId) {
        @if (hasCurrentProfileMeasurements() && hasRequiredFields) {
          <form [formGroup]="measurementModeForm">
            <mat-checkbox formControlName="useCurrentMeasurements">Use current client profile measurements</mat-checkbox>
          </form>
        }

        @if (fields.length === 0) {
          <p class="hint">No measurement fields configured for this product.</p>
        } @else {
          <form [formGroup]="measurementForm" class="dialog-grid">
            @for (field of fields; track field.key) {
              <mat-form-field appearance="outline" [class.span-all]="field.type === 'text'">
                <mat-label>{{ field.label }}{{ field.required ? ' *' : '' }}</mat-label>
                @if (field.type === 'text') {
                  <textarea
                    matInput
                    rows="3"
                    [formControlName]="field.key"
                    [readonly]="isUsingCurrentMeasurements"></textarea>
                } @else {
                  <input
                    matInput
                    type="number"
                    [formControlName]="field.key"
                    [readonly]="isUsingCurrentMeasurements" />
                }
                @if (measurementForm.get(field.key)?.hasError('required')) {
                  <mat-error>{{ field.label }} is required.</mat-error>
                }
              </mat-form-field>
            }
          </form>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">Cancel</button>
      <button mat-stroked-button type="button" (click)="reset()" [disabled]="!selectedItemTypeId">Reset</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="!canSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 8px;
    }
    .span-all {
      grid-column: 1 / -1;
    }
    .loading-state {
      min-height: 96px;
      display: grid;
      place-items: center;
      gap: 8px;
    }
    .hint {
      margin: 12px 0 0;
      opacity: 0.75;
    }
    @media (max-width: 760px) {
      .dialog-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ProductMeasurementsDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly measurementsService = inject(MeasurementsService);
  private readonly dialogRef = inject(MatDialogRef<ProductMeasurementsDialogComponent, ProductMeasurementsDialogResult | null>);

  protected isLoadingFields = false;
  protected fields: MeasurementFieldDto[] = [];
  protected selectedItemTypeId: number | null = null;

  protected readonly headerForm = this.fb.group({
    itemTypeId: [null as number | null, Validators.required],
    color: [''],
    material: ['']
  });
  protected readonly measurementModeForm = this.fb.group({
    useCurrentMeasurements: [true]
  });
  protected readonly measurementForm = this.fb.group({});

  private initialSnapshot: Record<string, number | string | null> = {};
  private initialColor = '';
  private initialMaterial = '';
  private initialUseCurrentMeasurements = true;
  private currentProfileValues: Record<string, number | string> = {};

  constructor(@Inject(MAT_DIALOG_DATA) protected readonly data: DialogData) {}

  ngOnInit(): void {
    this.headerForm.controls.itemTypeId.valueChanges.subscribe((itemTypeId) => {
      if (!itemTypeId) {
        this.selectedItemTypeId = null;
        this.fields = [];
        this.resetMeasurementForm();
        this.initialSnapshot = {};
        this.currentProfileValues = {};
        return;
      }
      this.loadFields(itemTypeId);
    });

    this.measurementModeForm.controls.useCurrentMeasurements.valueChanges.subscribe((useCurrent) => {
      if (useCurrent) {
        this.patchFromProfileValues();
      }
      this.syncMeasurementControlsState();
    });

    if (this.data.initialItemTypeId && this.data.initialItemTypeId > 0) {
      this.headerForm.patchValue({ itemTypeId: this.data.initialItemTypeId });
    }
  }

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected get isUsingCurrentMeasurements(): boolean {
    return this.measurementModeForm.controls.useCurrentMeasurements.value !== false;
  }

  protected reset(): void {
    if (!this.selectedItemTypeId) {
      return;
    }
    this.headerForm.patchValue(
      {
        color: this.initialColor,
        material: this.initialMaterial
      },
      { emitEvent: false }
    );
    this.measurementModeForm.patchValue(
      { useCurrentMeasurements: this.initialUseCurrentMeasurements },
      { emitEvent: false }
    );
    this.measurementForm.patchValue(this.initialSnapshot);
    this.syncMeasurementControlsState();
    this.measurementForm.markAsPristine();
    this.measurementForm.markAsUntouched();
  }

  protected canSave(): boolean {
    if (this.isLoadingFields || !this.selectedItemTypeId) {
      return false;
    }
    return (  this.headerForm.valid && this.measurementForm.valid) ||
      (this.isUsingCurrentMeasurements && this.hasCurrentProfileMeasurements());
  }

  protected hasCurrentProfileMeasurements(): boolean {
    return Object.keys(this.currentProfileValues).length > 0;
  }

  protected get hasRequiredFields(): boolean {
    return this.fields.some(f => f.required);
  }

  protected save(): void {
    if (!this.canSave() || !this.selectedItemTypeId) {
      this.measurementForm.markAllAsTouched();
      return;
    }

    const values: Record<string, number | string> = {};
    for (const field of this.fields) {
      const raw = this.measurementForm.get(field.key)?.value;
      if (raw === null || raw === undefined || raw === '') {
        continue;
      }

      if (field.type === 'text') {
        const textValue = String(raw).trim();
        if (textValue) {
          values[field.key] = textValue;
        }
        continue;
      }

      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        values[field.key] = numeric;
      }
    }

    const selectedItemType = this.data.itemTypes.find((itemType) => itemType.id === this.selectedItemTypeId);
    if (!selectedItemType) {
      return;
    }

    this.dialogRef.close({
      itemTypeId: this.selectedItemTypeId,
      itemTypeName: selectedItemType.name,
      fields: this.fields,
      values,
      useCurrentMeasurements: this.measurementModeForm.controls.useCurrentMeasurements.value !== false,
      color: this.cleanOptionalText(this.headerForm.getRawValue().color),
      material: this.cleanOptionalText(this.headerForm.getRawValue().material)
    });
  }

  private loadFields(itemTypeId: number): void {
    this.selectedItemTypeId = itemTypeId;
    this.isLoadingFields = true;
    this.fields = [];
    this.resetMeasurementForm();
    this.currentProfileValues = this.data.profileValuesByItemType[itemTypeId] ?? {};

    this.measurementsService
      .getMeasurementFields(itemTypeId)
      .pipe(
        catchError(() => of([])),
        finalize(() => {
          this.isLoadingFields = false;
        })
      )
      .subscribe((fields) => {
        const initialOrderDetails = this.data.initialOrderDetailsByItemType?.[itemTypeId] ?? {};
        const draftValues = this.data.draftValuesByItemType?.[itemTypeId] ?? {};
        this.initialColor = this.cleanOptionalText(initialOrderDetails.color) ?? '';
        this.initialMaterial = this.cleanOptionalText(initialOrderDetails.material) ?? '';
        this.headerForm.patchValue(
          {
            color: this.initialColor,
            material: this.initialMaterial
          },
          { emitEvent: false }
        );

        this.fields = fields;
        const hasRecordedValues = this.hasCurrentProfileMeasurements();
        const hasRequiredFields = this.fields.some(f => f.required);
        const useCurrentMeasurements =
          hasRecordedValues && hasRequiredFields
            ? (this.data.initialUseCurrentMeasurementsByItemType?.[itemTypeId] ?? true)
            : false;
        this.measurementModeForm.patchValue(
          { useCurrentMeasurements },
          { emitEvent: false }
        );
        this.initialUseCurrentMeasurements = useCurrentMeasurements;

        const sourceValues = useCurrentMeasurements ? this.currentProfileValues : draftValues;
        for (const field of this.fields) {
          const value = field.key in sourceValues ? sourceValues[field.key] : null;
          this.measurementForm.addControl(
            field.key,
            this.fb.control(value, field.required ? [Validators.required] : [])
          );
        }

        this.syncMeasurementControlsState();
        this.captureInitialSnapshot();
      });
  }

  private patchFromProfileValues(): void {
    if (!this.selectedItemTypeId || Object.keys(this.measurementForm.controls).length === 0) {
      return;
    }

    const patch: Record<string, number | string | null> = {};
    for (const field of this.fields) {
      patch[field.key] = field.key in this.currentProfileValues ? this.currentProfileValues[field.key] : null;
    }
    this.measurementForm.patchValue(patch);
  }

  private resetMeasurementForm(): void {
    for (const key of Object.keys(this.measurementForm.controls)) {
      this.measurementForm.removeControl(key);
    }
  }

  private syncMeasurementControlsState(): void {
    if (Object.keys(this.measurementForm.controls).length === 0) {
      return;
    }

    if (this.isUsingCurrentMeasurements) {
      this.measurementForm.disable({ emitEvent: false });
      return;
    }

    this.measurementForm.enable({ emitEvent: false });
  }

  private captureInitialSnapshot(): void {
    const snapshot: Record<string, number | string | null> = {};
    for (const field of this.fields) {
      const raw = this.measurementForm.get(field.key)?.value;
      snapshot[field.key] = raw === undefined ? null : raw;
    }
    this.initialSnapshot = snapshot;
    this.measurementForm.markAsPristine();
    this.measurementForm.markAsUntouched();
  }

  private cleanOptionalText(value: unknown): string | undefined {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length ? trimmed : undefined;
  }
}
