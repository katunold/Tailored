import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';
import { OrderStatus } from '../../../shared/status/status.types';

interface ClientOrder {
  id: string;
  item: string;
  status: OrderStatus;
  deliveryDate: string;
}

@Component({
  selector: 'app-client-details',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
    MatTabsModule,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent
  ],
  templateUrl: './client-details.component.html',
  styleUrl: './client-details.component.scss'
})
export class ClientDetailsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly orderColumns = ['id', 'item', 'status', 'deliveryDate'];
  protected readonly orders: ClientOrder[] = [
    { id: 'ORD-1042', item: 'Wedding suit', status: 'In Progress', deliveryDate: '2026-02-20' },
    { id: 'ORD-1051', item: 'Reception blazer', status: 'Fitting', deliveryDate: '2026-02-26' }
  ];

  protected readonly profileForm = this.fb.group({
    fullName: ['Avery Cole', Validators.required],
    phone: ['+1 555 0121', Validators.required],
    email: ['avery@example.com', [Validators.required, Validators.email]],
    address: ['221 Greenway Ave, Portland']
  });

  protected readonly measurementForm = this.fb.group({
    chest: [40, [Validators.required, Validators.min(20)]],
    waist: [34, [Validators.required, Validators.min(20)]],
    hip: [38, [Validators.required, Validators.min(20)]],
    shoulder: [18, [Validators.required, Validators.min(10)]],
    inseam: [30, [Validators.required, Validators.min(20)]]
  });

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.snackBar.open('Client profile saved.', 'Close', { duration: 1800 });
  }

  protected saveMeasurements(): void {
    if (this.measurementForm.invalid) {
      this.measurementForm.markAllAsTouched();
      return;
    }

    this.snackBar.open('Measurements saved.', 'Close', { duration: 1800 });
  }

  protected resetMeasurements(): void {
    this.measurementForm.patchValue({
      chest: 40,
      waist: 34,
      hip: 38,
      shoulder: 18,
      inseam: 30
    });
    this.snackBar.open('Measurements reset to defaults.', 'Close', { duration: 1800 });
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
}
