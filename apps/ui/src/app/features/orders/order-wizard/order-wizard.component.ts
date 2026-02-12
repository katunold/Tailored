import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatNativeDateModule } from '@angular/material/core';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { Subject, takeUntil } from 'rxjs';

interface OrderDraft {
  client: {
    clientName: string;
    phone: string;
  };
  order: {
    itemType: string;
    fabric: string;
    deliveryDate: string | null;
  };
  schedule: {
    firstFittingDate: string | null;
    notes: string;
  };
  stepIndex: number;
}

const DRAFT_KEY = 'tailored.order-wizard.draft';

@Component({
  selector: 'app-order-wizard',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSnackBarModule,
    MatStepperModule,
    PageHeaderComponent
  ],
  templateUrl: './order-wizard.component.html',
  styleUrl: './order-wizard.component.scss'
})
export class OrderWizardComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();

  protected currentStep = 0;

  protected readonly clientForm = this.fb.group({
    clientName: ['', Validators.required],
    phone: ['', Validators.required]
  });

  protected readonly orderForm = this.fb.group({
    itemType: ['Suit', Validators.required],
    fabric: ['Wool', Validators.required],
    deliveryDate: [null as Date | null, Validators.required]
  });

  protected readonly scheduleForm = this.fb.group({
    firstFittingDate: [null as Date | null, Validators.required],
    notes: ['']
  });

  constructor() {
    this.restoreDraft();
    this.setupAutosave();

    this.orderForm.controls.itemType.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((itemType) => {
      if (itemType === 'Suit') {
        this.orderForm.controls.fabric.setValue('Wool', { emitEvent: false });
      } else if (itemType === 'Dress') {
        this.orderForm.controls.fabric.setValue('Silk blend', { emitEvent: false });
      } else if (itemType === 'Shirt') {
        this.orderForm.controls.fabric.setValue('Cotton', { emitEvent: false });
      }

      this.persistDraft(false);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onStepChange(event: { selectedIndex: number }): void {
    this.currentStep = event.selectedIndex;
    this.persistDraft(false);
  }

  protected goBack(stepper: { previous: () => void }): void {
    stepper.previous();
  }

  protected goNext(stepper: { next: () => void }): void {
    stepper.next();
  }

  protected saveDraft(): void {
    this.persistDraft(true);
  }

  protected submitOrder(): void {
    if (this.clientForm.invalid || this.orderForm.invalid || this.scheduleForm.invalid) {
      this.clientForm.markAllAsTouched();
      this.orderForm.markAllAsTouched();
      this.scheduleForm.markAllAsTouched();
      this.snackBar.open('Complete all required fields before submitting.', 'Close', { duration: 2500 });
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    this.snackBar.open('Order created successfully.', 'Close', { duration: 2500 });

    this.clientForm.reset({ clientName: '', phone: '' });
    this.orderForm.reset({ itemType: 'Suit', fabric: 'Wool', deliveryDate: null });
    this.scheduleForm.reset({ firstFittingDate: null, notes: '' });
    this.currentStep = 0;
  }

  protected discardDraft(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Discard draft?',
        message: 'This removes your unsaved order wizard progress.',
        confirmText: 'Discard',
        cancelText: 'Keep Draft'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      localStorage.removeItem(DRAFT_KEY);
      this.clientForm.reset({ clientName: '', phone: '' });
      this.orderForm.reset({ itemType: 'Suit', fabric: 'Wool', deliveryDate: null });
      this.scheduleForm.reset({ firstFittingDate: null, notes: '' });
      this.currentStep = 0;
      this.snackBar.open('Draft discarded.', 'Close', { duration: 2000 });
    });
  }

  private setupAutosave(): void {
    this.clientForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.persistDraft(false));
    this.orderForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.persistDraft(false));
    this.scheduleForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.persistDraft(false));
  }

  private persistDraft(showToast: boolean): void {
    const draft: OrderDraft = {
      client: {
        clientName: this.clientForm.value.clientName ?? '',
        phone: this.clientForm.value.phone ?? ''
      },
      order: {
        itemType: this.orderForm.value.itemType ?? 'Suit',
        fabric: this.orderForm.value.fabric ?? 'Wool',
        deliveryDate: this.toIsoDate(this.orderForm.value.deliveryDate ?? null)
      },
      schedule: {
        firstFittingDate: this.toIsoDate(this.scheduleForm.value.firstFittingDate ?? null),
        notes: this.scheduleForm.value.notes ?? ''
      },
      stepIndex: this.currentStep
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    if (showToast) {
      this.snackBar.open('Draft saved.', 'Close', { duration: 1500 });
    }
  }

  private restoreDraft(): void {
    const raw = localStorage.getItem(DRAFT_KEY);

    if (!raw) {
      return;
    }

    try {
      const draft = JSON.parse(raw) as OrderDraft;

      this.clientForm.patchValue(draft.client ?? {});
      this.orderForm.patchValue({
        itemType: draft.order?.itemType ?? 'Suit',
        fabric: draft.order?.fabric ?? 'Wool',
        deliveryDate: this.toDate(draft.order?.deliveryDate ?? null)
      });
      this.scheduleForm.patchValue({
        firstFittingDate: this.toDate(draft.schedule?.firstFittingDate ?? null),
        notes: draft.schedule?.notes ?? ''
      });
      this.currentStep = draft.stepIndex ?? 0;

      this.snackBar.open('Draft restored.', 'Close', { duration: 1800 });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  private toIsoDate(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  private toDate(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
