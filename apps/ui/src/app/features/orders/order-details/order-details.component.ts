import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

interface FittingSchedule {
  id: string;
  date: Date;
  note: string;
}

@Component({
  selector: 'app-order-details',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatTabsModule,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss'
})
export class OrderDetailsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly measurementForm = this.fb.group({
    chest: [40, [Validators.required, Validators.min(20)]],
    waist: [34, [Validators.required, Validators.min(20)]],
    hip: [38, [Validators.required, Validators.min(20)]],
    inseam: [30, [Validators.required, Validators.min(20)]]
  });

  protected readonly fittingForm = this.fb.group({
    fittingDate: [null as Date | null, Validators.required],
    note: ['']
  });

  protected readonly noteForm = this.fb.group({
    notes: ['']
  });

  protected fittings: FittingSchedule[] = [];

  protected saveAll(): void {
    this.snackBar.open('Order details saved.', 'Close', { duration: 2000 });
  }

  protected resetMeasurementsToDefaults(): void {
    this.measurementForm.patchValue({
      chest: 40,
      waist: 34,
      hip: 38,
      inseam: 30
    });

    this.snackBar.open('Measurements reset to current profile defaults.', 'Close', { duration: 2000 });
  }

  protected scheduleFitting(): void {
    if (this.fittingForm.invalid) {
      this.fittingForm.markAllAsTouched();
      return;
    }

    this.fittings = [
      ...this.fittings,
      {
        id: crypto.randomUUID(),
        date: this.fittingForm.value.fittingDate as Date,
        note: this.fittingForm.value.note ?? ''
      }
    ];

    this.fittingForm.reset({ fittingDate: null, note: '' });
    this.snackBar.open('Fitting scheduled.', 'Close', { duration: 1800 });
  }

  protected removeFitting(id: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove fitting?',
        message: 'This action cannot be undone.',
        confirmText: 'Remove',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.fittings = this.fittings.filter((fitting) => fitting.id !== id);
      this.snackBar.open('Fitting removed.', 'Close', { duration: 1800 });
    });
  }
}
