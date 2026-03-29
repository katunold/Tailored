import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { PhoneInputDirective } from '../../../shared/directives/phone-input.directive';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';
import { OrderStatus } from '../../../shared/status/status.types';
import { phoneValidator } from '../../../shared/validators/phone.validator';
import { OrdersService, ClientOrderRow } from '../../orders/orders.service';
import { ClientDto, ClientsService } from '../clients.service';
import { MeasurementsService, MeasurementProfileDto } from '../measurements.service';

@Component({
  selector: 'app-client-details',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    PhoneInputDirective
  ],
  templateUrl: './client-details.component.html',
  styleUrl: './client-details.component.scss'
})
export class ClientDetailsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientsService = inject(ClientsService);
  private readonly measurementsService = inject(MeasurementsService);
  private readonly ordersService = inject(OrdersService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected clientId: number | null = null;
  protected client: ClientDto | null = null;
  protected isLoading = true;
  protected loadFailed = false;
  protected isMeasurementsLoading = false;
  protected isSavingMeasurements = false;
  protected isOrdersLoading = false;
  protected measurementProducts: MeasurementProfileDto['products'] = [];
  protected selectedItemTypeId: number | null = null;

  protected readonly orderColumns = ['id', 'item', 'status', 'createdAt', 'deliveryDate'];
  protected orders: ClientOrderRow[] = [];

  protected readonly profileForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, phoneValidator]],
    notes: ['']
  });

  protected readonly measurementForm = this.fb.group({});
  private originalMeasurementValues: Record<string, number | string | null> = {};

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.isLoading = false;
      this.loadFailed = true;
      return;
    }

    this.clientId = id;
    this.loadClient(id);
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.snackBar.open('Client profile saved.', 'Close', { duration: 1800 });
  }

  protected saveMeasurements(): void {
    const selectedProduct = this.selectedMeasurementProduct();
    if (!this.clientId || !selectedProduct) {
      return;
    }
    if (this.measurementForm.invalid) {
      this.measurementForm.markAllAsTouched();
      return;
    }

    this.isSavingMeasurements = true;
    const values: Record<string, number | string> = {};

    for (const field of selectedProduct.fields) {
      const raw = this.measurementForm.get(field.key)?.value;

      if (raw === null || raw === undefined || raw === '') {
        continue;
      }

      if (field.type === 'text') {
        const textValue = String(raw).trim();
        if (!textValue) {
          continue;
        }
        values[field.key] = textValue;
        continue;
      }

      const numericValue = Number(raw);
      if (!Number.isFinite(numericValue)) {
        continue;
      }

      values[field.key] = numericValue;
    }

    this.measurementsService
      .upsertMeasurementProfile(this.clientId, selectedProduct.itemTypeId, values)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not save measurements.', 'Close', { duration: 2500 });
          return of(null);
        }),
        finalize(() => {
          this.isSavingMeasurements = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((saved) => {
        if (!saved) {
          return;
        }

        const nextProducts = this.measurementProducts.map((product) =>
          product.itemTypeId === saved.itemTypeId
            ? {
                ...product,
                measurementId: saved.id,
                valuesJson: saved.valuesJson,
                updatedAt: saved.updatedAt,
                values: saved.values
              }
            : product
        );
        this.measurementProducts = nextProducts;
        this.selectMeasurementProduct(saved.itemTypeId);
        this.captureMeasurementSnapshot();
        this.measurementForm.markAsPristine();
        this.snackBar.open('Measurements saved.', 'Close', { duration: 1800 });
      });
  }

  protected resetMeasurements(): void {
    this.measurementForm.patchValue(this.originalMeasurementValues);
    this.measurementForm.markAsPristine();
    this.measurementForm.markAsUntouched();
    this.snackBar.open('Measurements reset.', 'Close', { duration: 1800 });
  }

  protected hasUnsavedMeasurementChanges(): boolean {
    const selectedProduct = this.selectedMeasurementProduct();
    if (!selectedProduct) {
      return false;
    }

    const fields = Array.isArray(selectedProduct.fields) ? selectedProduct.fields : [];
    if (fields.length === 0) {
      return false;
    }

    for (const field of fields) {
      const currentRaw = this.measurementForm.get(field.key)?.value;
      const current = this.normalizeFieldValue(field.type, currentRaw);

      const originalRaw = this.originalMeasurementValues[field.key];
      const original = this.normalizeFieldValue(field.type, originalRaw);

      if (current !== original) {
        return true;
      }
    }

    return false;
  }

  protected archiveClient(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Archive client?',
        message: 'The client will be hidden from active lists.',
        confirmText: 'Archive',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.snackBar.open('Client archived.', 'Close', { duration: 2000 });
    });
  }

  protected backToClients(): void {
    this.router.navigate(['/clients']);
  }

  private loadClient(id: number): void {
    this.isLoading = true;
    this.loadFailed = false;

    this.clientsService
      .getClientById(id)
      .pipe(
        catchError(() => {
          this.loadFailed = true;
          this.snackBar.open('Could not load client details.', 'Close', { duration: 2500 });
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((client) => {
        this.cdr.detectChanges();
        if (!client) {
          this.client = null;
          return;
        }

        this.client = client;
        this.profileForm.patchValue({
          fullName: client.fullName,
          phone: client.phone,
          notes: client.notes ?? ''
        });

        this.loadMeasurements(client.id);
        this.loadOrders(client.id);
      });
  }

  private loadMeasurements(clientId: number): void {
    this.isMeasurementsLoading = true;
    this.measurementProducts = [];
    this.selectedItemTypeId = null;
    this.originalMeasurementValues = {};
    this.resetMeasurementForm();

    forkJoin({
      profile: this.measurementsService.getMeasurementProfile(clientId).pipe(catchError(() => of(null))),
      itemTypes: this.ordersService.getItemTypes().pipe(catchError(() => of([])))
    })
      .pipe(
        switchMap(({ profile, itemTypes }) => {
          const normalizedProducts = this.normalizeMeasurementProducts(profile);
          const profileByItemTypeId = new Map(
            normalizedProducts.map((product) => [product.itemTypeId, product] as const)
          );

          if (itemTypes.length === 0) {
            return of(normalizedProducts);
          }

          return forkJoin(
            itemTypes.map((itemType) =>
              this.measurementsService.getMeasurementFields(itemType.id).pipe(
                map((fields) => {
                  const existing = profileByItemTypeId.get(itemType.id);
                  return {
                    itemTypeId: itemType.id,
                    itemTypeName: itemType.name,
                    fields:
                      existing && Array.isArray(existing.fields) && existing.fields.length > 0
                        ? existing.fields
                        : Array.isArray(fields)
                          ? fields
                          : [],
                    measurementId: existing?.measurementId ?? null,
                    valuesJson: existing?.valuesJson ?? null,
                    updatedAt: existing?.updatedAt ?? null,
                    values: existing?.values ?? {}
                  };
                }),
                catchError(() => {
                  const existing = profileByItemTypeId.get(itemType.id);
                  return of({
                    itemTypeId: itemType.id,
                    itemTypeName: itemType.name,
                    fields: existing?.fields ?? [],
                    measurementId: existing?.measurementId ?? null,
                    valuesJson: existing?.valuesJson ?? null,
                    updatedAt: existing?.updatedAt ?? null,
                    values: existing?.values ?? {}
                  });
                })
              )
            )
          );
        }),
        catchError(() => {
          this.snackBar.open('Could not load measurements.', 'Close', { duration: 2500 });
          return of([] as MeasurementProfileDto['products']);
        }),
        finalize(() => {
          this.isMeasurementsLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((products) => {
        this.measurementProducts = products;
        if (this.measurementProducts.length === 0) {
          return;
        }

        const preferredItemTypeId =
          this.selectedItemTypeId && this.measurementProducts.some((p) => p.itemTypeId === this.selectedItemTypeId)
            ? this.selectedItemTypeId
            : this.measurementProducts[0].itemTypeId;
        this.selectMeasurementProduct(preferredItemTypeId);
        this.cdr.detectChanges();
      });
  }

  protected selectMeasurementProduct(itemTypeId: number): void {
    const product = this.measurementProducts.find((entry) => entry.itemTypeId === itemTypeId) ?? null;
    this.selectedItemTypeId = product?.itemTypeId ?? null;
    this.originalMeasurementValues = {};
    this.resetMeasurementForm();

    if (!product) {
      return;
    }

    const fields = Array.isArray(product.fields) ? product.fields : [];
    const values = product.values ?? {};
    const isOthersProduct = product.itemTypeName.trim().toLowerCase() === 'others';

    for (const field of fields) {
      const value = field.key in values ? values[field.key] : null;
      const validators = field.required ? [Validators.required] : [];
      if (isOthersProduct && field.key === 'productName') {
        validators.push(this.otherProductNameExistsValidator(product.itemTypeId));
      }
      this.measurementForm.addControl(
        field.key,
        this.fb.control(value, validators)
      );
      this.originalMeasurementValues[field.key] = value;
    }

    this.measurementForm.markAsPristine();
    this.measurementForm.markAsUntouched();
  }

  private loadOrders(clientId: number): void {
    this.isOrdersLoading = true;
    this.orders = [];

    this.ordersService
      .getOrdersByClient(clientId)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load orders.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isOrdersLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((orders) => {
        this.orders = orders;
      });
  }

  private resetMeasurementForm(): void {
    for (const key of Object.keys(this.measurementForm.controls)) {
      this.measurementForm.removeControl(key);
    }
  }

  private captureMeasurementSnapshot(): void {
    const nextSnapshot: Record<string, number | string | null> = {};
    const selectedProduct = this.selectedMeasurementProduct();
    if (!selectedProduct) {
      this.originalMeasurementValues = nextSnapshot;
      return;
    }

    const fields = Array.isArray(selectedProduct.fields) ? selectedProduct.fields : [];
    for (const field of fields) {
      const raw = this.measurementForm.get(field.key)?.value;
      nextSnapshot[field.key] = this.normalizeFieldValue(field.type, raw);
    }

    this.originalMeasurementValues = nextSnapshot;
  }

  protected selectedMeasurementProduct(): MeasurementProfileDto['products'][number] | null {
    if (this.selectedItemTypeId === null) return null;
    return this.measurementProducts.find((entry) => entry.itemTypeId === this.selectedItemTypeId) ?? null;
  }

  private normalizeMeasurementProducts(profile: unknown): MeasurementProfileDto['products'] {
    const rawProducts = (profile as { products?: unknown } | null)?.products;
    if (!Array.isArray(rawProducts)) {
      return [];
    }

    return rawProducts.map((product) => {
      const row = product as MeasurementProfileDto['products'][number];
      return {
        ...row,
        fields: Array.isArray(row.fields) ? row.fields : [],
        values: row.values ?? {}
      };
    });
  }

  protected isTextMeasurementField(field: { type: 'number' | 'text' }): boolean {
    return field.type === 'text';
  }

  private otherProductNameExistsValidator(currentItemTypeId: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = String(control.value ?? '').trim().toLowerCase();
      if (!raw) {
        return null;
      }

      const exists = this.measurementProducts.some(
        (product) => product.itemTypeId !== currentItemTypeId && product.itemTypeName.trim().toLowerCase() === raw
      );
      return exists ? { productExists: true } : null;
    };
  }

  private normalizeFieldValue(
    fieldType: 'number' | 'text',
    raw: unknown
  ): number | string | null {
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }

    if (fieldType === 'text') {
      const textValue = String(raw).trim();
      return textValue.length > 0 ? textValue : null;
    }

    const numericValue = Number(raw);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
}
