import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { PhoneInputDirective } from '../../../shared/directives/phone-input.directive';
import { phoneValidator } from '../../../shared/validators/phone.validator';
import { ClientsService } from '../clients.service';

@Component({
  selector: 'app-client-create',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    PageHeaderComponent,
    PhoneInputDirective
  ],
  templateUrl: './client-create.component.html',
  styleUrl: './client-create.component.scss'
})
export class ClientCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly clientsService = inject(ClientsService);
  protected isSaving = false;

  protected readonly clientForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, phoneValidator]],
    notes: ['']
  });

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
        }),
        finalize(() => {
          this.isSaving = false;
        })
      )
      .subscribe((createdClient) => {
        if (!createdClient) {
          return;
        }

        this.snackBar.open('Client created.', 'Close', { duration: 1800 });
        this.router.navigate(['/clients', createdClient.id]);
      });
  }

  protected cancel(): void {
    this.router.navigate(['/clients']);
  }
}
