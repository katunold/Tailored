import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ClientsService } from '../clients.service';
import { MeasurementFieldDto, MeasurementsService } from '../measurements.service';

@Component({
  selector: 'app-client-create',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent
  ],
  templateUrl: './client-create.component.html',
  styleUrl: './client-create.component.scss'
})
export class ClientCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly clientsService = inject(ClientsService);
  private readonly measurementsService = inject(MeasurementsService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected isLoadingFields = true;
  protected isSaving = false;
  protected measurementFields: MeasurementFieldDto[] = [];

  protected readonly clientForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', Validators.required],
    notes: ['']
  });

  protected readonly measurementForm = this.fb.group({});

  ngOnInit(): void {
    this.loadMeasurementFields();
  }

  protected saveClient(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const payload = {
      fullName: this.clientForm.value.fullName?.trim() ?? '',
      phone: this.clientForm.value.phone?.trim() ?? '',
      notes: this.clientForm.value.notes?.trim() || null
    };

    this.isSaving = true;

    this.clientsService
      .createClient(payload)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not create client.', 'Close', { duration: 2500 });
          return of(null);
        })
      )
      .subscribe((createdClient) => {
        if (!createdClient) {
          this.isSaving = false;
          return;
        }

        const values = this.collectMeasurementValues();
        if (Object.keys(values).length === 0) {
          this.isSaving = false;
          this.snackBar.open('Client created.', 'Close', { duration: 1800 });
          this.router.navigate(['/clients', createdClient.id]);
          return;
        }

        this.measurementsService
          .upsertMeasurementProfile(createdClient.id, values)
          .pipe(
            catchError(() => {
              this.snackBar.open('Client created, but could not save measurements.', 'Close', { duration: 3000 });
              return of(null);
            }),
            finalize(() => {
              this.isSaving = false;
            })
          )
          .subscribe(() => {
            this.snackBar.open('Client and measurements created.', 'Close', { duration: 1800 });
            this.router.navigate(['/clients', createdClient.id]);
          });
      });
  }

  protected cancel(): void {
    this.router.navigate(['/clients']);
  }

  private loadMeasurementFields(): void {
    this.isLoadingFields = true;

    this.measurementsService
      .getMeasurementFields()
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load measurement fields.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isLoadingFields = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((fields) => {
        this.measurementFields = fields;
        for (const field of fields) {
          this.measurementForm.addControl(field.key, this.fb.control<number | null>(null));
        }
        // this.cdr.detectChanges();
      });
  }

  private collectMeasurementValues(): Record<string, number> {
    const values: Record<string, number> = {};

    for (const field of this.measurementFields) {
      const raw = this.measurementForm.get(field.key)?.value;
      if (raw === null || raw === undefined || raw === '') {
        continue;
      }

      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        continue;
      }

      values[field.key] = numeric;
    }

    return values;
  }
}
