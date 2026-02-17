import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';
import { OrderStatus } from '../../../shared/status/status.types';
import { OrdersService, ClientOrderRow } from '../../orders/orders.service';
import { ClientDto, ClientsService } from '../clients.service';
import { MeasurementFieldDto, MeasurementsService } from '../measurements.service';

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
  protected measurementFields: MeasurementFieldDto[] = [];

  protected readonly orderColumns = ['id', 'item', 'status', 'deliveryDate'];
  protected orders: ClientOrderRow[] = [];

  protected readonly profileForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', Validators.required],
    notes: ['']
  });

  protected readonly measurementForm = this.fb.group({});
  private originalMeasurementValues: Record<string, number | null> = {};

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
    if (!this.clientId || this.measurementFields.length === 0) {
      return;
    }

    this.isSavingMeasurements = true;
    const values: Record<string, number> = {};

    for (const field of this.measurementFields) {
      const raw = this.measurementForm.get(field.key)?.value;

      if (raw === null || raw === undefined || raw === '') {
        continue;
      }

      const numericValue = Number(raw);
      if (!Number.isFinite(numericValue)) {
        continue;
      }

      values[field.key] = numericValue;
    }

    this.measurementsService
      .upsertMeasurementProfile(this.clientId, values)
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
    this.measurementFields = [];
    this.originalMeasurementValues = {};
    this.resetMeasurementForm();

    forkJoin({
      fields: this.measurementsService.getMeasurementFields().pipe(
        catchError(() => {
          this.snackBar.open('Could not load measurement fields.', 'Close', { duration: 2500 });
          return of([]);
        })
      ),
      profile: this.measurementsService.getMeasurementProfile(clientId).pipe(catchError(() => of(null)))
    })
      .pipe(
        finalize(() => {
          this.isMeasurementsLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe(({ fields, profile }) => {
        this.measurementFields = fields;
        const profileValues = profile?.values ?? {};

        for (const field of this.measurementFields) {
          const value = field.key in profileValues ? profileValues[field.key] : null;
          this.measurementForm.addControl(field.key, this.fb.control(value));
          this.originalMeasurementValues[field.key] = value;
        }

        this.measurementForm.markAsPristine();
        this.measurementForm.markAsUntouched();
        this.cdr.detectChanges();
      });
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
    const nextSnapshot: Record<string, number | null> = {};

    for (const field of this.measurementFields) {
      const raw = this.measurementForm.get(field.key)?.value;
      nextSnapshot[field.key] = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    }

    this.originalMeasurementValues = nextSnapshot;
  }
}
