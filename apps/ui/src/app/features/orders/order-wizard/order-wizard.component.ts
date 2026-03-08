import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { catchError, finalize, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { PhoneInputDirective } from '../../../shared/directives/phone-input.directive';
import { phoneValidator } from '../../../shared/validators/phone.validator';
import { MeasurementsService } from '../../clients/measurements.service';
import { ClientsService } from '../../clients/clients.service';
import {
  CreateOrderPayload,
  OrderItemType,
  OrdersService
} from '../orders.service';
import { ProductMeasurementsDialogComponent } from './product-measurements-dialog.component';

type ProductMeasurementRow = {
  itemTypeId: number;
  itemTypeName: string;
  useCurrentMeasurements: boolean;
  color: string | null;
  material: string | null;
  values: Array<{ key: string; label: string; value: number | string }>;
};

@Component({
  selector: 'app-order-wizard',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatStepperModule,
    DatePipe,
    PageHeaderComponent,
    PhoneInputDirective
  ],
  templateUrl: './order-wizard.component.html',
  styleUrl: './order-wizard.component.scss'
})
export class OrderWizardComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;

  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly clientsService = inject(ClientsService);
  private readonly measurementsService = inject(MeasurementsService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected currentStep = 0;
  protected isSubmitting = false;
  protected isLoadingItemTypes = false;
  protected isLoadingClientProfile = false;
  protected isLoadingClients = false;
  protected isCreatingClient = false;
  protected showNewClientForm = false;

  protected scopedClientId: number | null = null;
  protected itemTypes: OrderItemType[] = [];
  protected clients: Array<{ id: number; fullName: string; phone: string; notes: string | null }> = [];
  protected filteredClients: Array<{ id: number; fullName: string; phone: string; notes: string | null }> = [];
  protected clientSearchTerm = '';
  protected clientProfileMeasurementsByItemType: Record<number, Record<string, number>> = {};
  protected clientProfileAllValuesByItemType: Record<number, Record<string, number | string>> = {};
  protected draftMeasurementsByItemType: Record<number, Record<string, number | string>> = {};
  protected addedProductMeasurements: ProductMeasurementRow[] = [];

  protected readonly clientForm = this.fb.group({
    clientId: [null as number | null, Validators.required],
    clientName: [''],
    phone: ['']
  });
  protected readonly newClientForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, phoneValidator]],
    notes: ['']
  });

  protected readonly deliveryForm = this.fb.group({
    dueDate: [null as Date | null, Validators.required],
    notes: ['']
  });

  ngOnInit(): void {
    const scopedClientId = Number(this.route.snapshot.queryParamMap.get('clientId'));
    this.scopedClientId = Number.isInteger(scopedClientId) && scopedClientId > 0 ? scopedClientId : null;
    if (this.scopedClientId !== null) {
      this.clientForm.patchValue({ clientId: this.scopedClientId });
      this.currentStep = 1;
      this.loadScopedClient(this.scopedClientId);
      this.loadClientProfile(this.scopedClientId);
    } else {
      this.loadClients();
    }

    this.loadItemTypes();

    this.clientForm.controls.clientId.valueChanges.subscribe((clientId) => {
      if (this.scopedClientId !== null) {
        return;
      }

      if (!clientId) {
        this.clientForm.patchValue(
          {
            clientName: '',
            phone: ''
          },
          { emitEvent: false }
        );
        this.clientProfileMeasurementsByItemType = {};
        this.clientProfileAllValuesByItemType = {};
        this.draftMeasurementsByItemType = {};
        this.addedProductMeasurements = [];
        return;
      }

      const selectedClient = this.clients.find((client) => client.id === clientId);
      if (!selectedClient) {
        return;
      }

      this.clientForm.patchValue(
        {
          clientName: selectedClient.fullName,
          phone: selectedClient.phone
        },
        { emitEvent: false }
      );
      this.clientSearchTerm = '';
      this.filterClients('');
      this.draftMeasurementsByItemType = {};
      this.addedProductMeasurements = [];
      this.loadClientProfile(selectedClient.id);
    });
  }

  protected summaryStepIndex(): number {
    return 3;
  }

  protected isOnSummaryStep(): boolean {
    return this.currentStep === this.summaryStepIndex();
  }

  protected onStepChange(event: { selectedIndex: number }): void {
    this.currentStep = event.selectedIndex;
  }

  protected goBack(): void {
    this.stepper.previous();
  }

  protected goNext(): void {
    if (!this.canProceedFromCurrentStep()) {
      return;
    }

    this.stepper.next();
  }

  protected submitOrder(): void {
    if (!this.validateBeforeSubmit()) {
      return;
    }

    const clientId = this.resolveClientId();
    if (!clientId) {
      this.snackBar.open('Client is required.', 'Close', { duration: 2500 });
      return;
    }

    if (this.addedProductMeasurements.length === 0) {
      this.snackBar.open('Add at least one product.', 'Close', { duration: 2500 });
      return;
    }

    this.isSubmitting = true;

    const payload: CreateOrderPayload = {
      clientId,
      status: 'PLACED',
      dueDate: this.deliveryForm.value.dueDate?.toISOString(),
      notes: this.deliveryForm.value.notes?.trim() || null,
      items: this.buildOrderItemsFromAddedProducts()
    };

    this.ordersService
      .createOrder(payload)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const missingMessage = this.toMissingMeasurementsMessage(err);
          const errorMessage = String((err.error as { error?: string } | null)?.error ?? '').trim();
          this.snackBar.open((missingMessage ?? errorMessage) || 'Could not create order.', 'Close', { duration: 3500 });
          return of(null);
        }),
        finalize(() => {
          this.isSubmitting = false;
        })
      )
      .subscribe((created) => {
        if (!created) {
          return;
        }

        this.snackBar.open('Order created successfully.', 'Close', { duration: 2500 });
        this.router.navigate(['/orders', created.id]);
      });
  }

  protected summaryClientId(): string {
    const id = this.resolveClientId();
    return id === null ? 'N/A' : String(id);
  }

  protected summaryClientName(): string {
    return this.clientForm.getRawValue().clientName?.trim() || 'N/A';
  }

  protected summaryClientPhone(): string {
    return this.clientForm.getRawValue().phone?.trim() || 'N/A';
  }

  protected summaryMeasurementEntries(product: ProductMeasurementRow): Array<{ key: string; label: string; value: number | string }> {
    return product.values.filter((entry) => this.isMeasurementValue(entry.value));
  }

  protected summaryDetailEntries(product: ProductMeasurementRow): Array<{ key: string; label: string; value: number | string }> {
    const details: Array<{ key: string; label: string; value: number | string }> = [];
    if (product.color) {
      details.push({ key: 'color', label: 'Color', value: product.color });
    }
    if (product.material) {
      details.push({ key: 'material', label: 'Material', value: product.material });
    }

    for (const entry of product.values) {
      if (!this.isMeasurementValue(entry.value)) {
        details.push(entry);
      }
    }

    return details;
  }

  protected canGoNext(): boolean {
    const clientStepIndex = 0;
    const productsStepIndex = 1;
    const deliveryStepIndex = 2;

    if (this.isSubmitting || this.isLoadingClients || this.isCreatingClient) {
      return false;
    }

    if (this.currentStep === clientStepIndex) {
      return this.clientForm.valid;
    }

    if (this.currentStep === productsStepIndex) {
      if (this.isLoadingItemTypes) {
        return false;
      }
      return this.addedProductMeasurements.length > 0;
    }

    if (this.currentStep === deliveryStepIndex) {
      return this.deliveryForm.valid;
    }

    return false;
  }

  private loadItemTypes(): void {
    this.isLoadingItemTypes = true;

    this.ordersService
      .getItemTypes()
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load item types.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isLoadingItemTypes = false;
        })
      )
      .subscribe((itemTypes) => {
        this.itemTypes = itemTypes;
      });
  }

  protected filteredClientCountLabel(): string {
    return `${this.filteredClients.length} available`;
  }

  protected hasSelectedClient(): boolean {
    const clientId = this.clientForm.getRawValue().clientId;
    return typeof clientId === 'number' && Number.isInteger(clientId) && clientId > 0;
  }

  protected onClientSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.clientSearchTerm = value;
    this.filterClients(value);
  }

  protected onClientSelectOpened(isOpen: boolean): void {
    if (isOpen) {
      this.filterClients(this.clientSearchTerm);
      return;
    }

    this.clientSearchTerm = '';
    this.filterClients('');
  }

  protected stopClientFilterEvent(event: Event): void {
    event.stopPropagation();
  }

  protected addNewClientToOrder(): void {
    if (this.newClientForm.invalid) {
      this.newClientForm.markAllAsTouched();
      return;
    }

    const payload = {
      fullName: this.newClientForm.value.fullName?.trim() ?? '',
      phone: this.newClientForm.value.phone?.trim() ?? '',
      notes: this.newClientForm.value.notes?.trim() || null
    };
    const duplicate = this.findClientByPhone(payload.phone);
    if (duplicate) {
      this.snackBar.open('Phone number already belongs to an existing client.', 'Close', { duration: 2800 });
      return;
    }

    this.isCreatingClient = true;
    this.clientsService
      .createClient(payload)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (this.isDuplicatePhoneError(err)) {
            this.snackBar.open('Phone number already belongs to an existing client.', 'Close', { duration: 2800 });
          } else {
            this.snackBar.open('Could not create client.', 'Close', { duration: 2500 });
          }
          return of(null);
        }),
        finalize(() => {
          this.isCreatingClient = false;
        })
      )
      .subscribe((createdClient) => {
        if (!createdClient) {
          return;
        }

        this.clients = [createdClient, ...this.clients];
        this.clientSearchTerm = '';
        this.filterClients('');
        this.clientForm.patchValue({
          clientId: createdClient.id
        });
        this.showNewClientForm = false;
        this.newClientForm.reset({
          fullName: '',
          phone: '',
          notes: ''
        });
        this.snackBar.open('Client added and selected for this order.', 'Close', { duration: 2200 });
      });
  }

  protected openNewClientForm(): void {
    this.showNewClientForm = true;
    this.clientSearchTerm = '';
    this.filterClients('');
    this.clientForm.patchValue(
      {
        clientId: null,
        clientName: '',
        phone: ''
      },
      { emitEvent: false }
    );
    this.clientProfileMeasurementsByItemType = {};
    this.clientProfileAllValuesByItemType = {};
    this.draftMeasurementsByItemType = {};
    this.addedProductMeasurements = [];
  }

  protected cancelNewClientForm(): void {
    this.showNewClientForm = false;
    this.newClientForm.reset({
      fullName: '',
      phone: '',
      notes: ''
    });
  }

  private loadClients(): void {
    this.isLoadingClients = true;

    this.clientsService
      .getClients()
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load clients.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isLoadingClients = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((clients) => {
        this.clients = clients;
        this.filterClients(this.clientSearchTerm);
        this.cdr.detectChanges();
      });
  }

  private filterClients(query: string): void {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      this.filteredClients = [...this.clients];
      return;
    }

    this.filteredClients = this.clients.filter((client) =>
      `${client.fullName} ${client.phone}`.toLowerCase().includes(trimmed)
    );
  }

  private findClientByPhone(phone: string): { id: number; fullName: string; phone: string; notes: string | null } | null {
    const normalizedTarget = this.normalizePhone(phone);
    if (!normalizedTarget) {
      return null;
    }

    const match =
      this.clients.find((client) => this.normalizePhone(client.phone) === normalizedTarget) ??
      null;

    return match;
  }

  private normalizePhone(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly || phone.trim().toLowerCase();
  }

  private isDuplicatePhoneError(err: HttpErrorResponse): boolean {
    if (err.status === 409) {
      return true;
    }

    const message = String((err.error as { error?: string } | null)?.error ?? '').toLowerCase();
    return message.includes('unique') || message.includes('phone');
  }

  private canProceedFromCurrentStep(): boolean {
    if (this.canGoNext()) {
      return true;
    }

    if (this.currentStep === 0) {
      this.clientForm.markAllAsTouched();
    } else if (this.currentStep === 1) {
      return false;
    } else if (this.currentStep === 2) {
      this.deliveryForm.markAllAsTouched();
    }

    return false;
  }

  private validateBeforeSubmit(): boolean {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return false;
    }

    if (this.deliveryForm.controls.dueDate.invalid) {
      this.deliveryForm.markAllAsTouched();
      return false;
    }

    if (this.addedProductMeasurements.length === 0) {
      return false;
    }

    return true;
  }

  private buildOrderItemsFromAddedProducts(): CreateOrderPayload['items'] {
    return this.addedProductMeasurements.map((product) => {
      const values =
        this.draftMeasurementsByItemType[product.itemTypeId] ??
        this.clientProfileAllValuesByItemType[product.itemTypeId] ??
        {};
      const measurementsInput = this.toOrderMeasurementInput(values);
      const isOthers = product.itemTypeName.trim().toLowerCase() === 'others';
      const productName =
        isOthers && typeof values['productName'] === 'string' ? values['productName'].trim() : '';
      const notes = isOthers && typeof values['notes'] === 'string' ? values['notes'].trim() : '';

      return {
        itemTypeId: product.itemTypeId,
        quantity: 1,
        ...(product.color ? { color: product.color } : {}),
        ...(product.material ? { material: product.material } : {}),
        useCurrentMeasurements: measurementsInput ? product.useCurrentMeasurements : true,
        ...(measurementsInput ? { measurementsInput } : {}),
        ...(productName ? { otherProductName: productName } : {}),
        ...(notes ? { itemNotes: notes } : {})
      };
    });
  }

  private resolveClientId(): number | null {
    if (this.scopedClientId) {
      return this.scopedClientId;
    }

    const id = this.clientForm.getRawValue().clientId;
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
  }

  private loadScopedClient(clientId: number): void {
    this.clientsService
      .getClientById(clientId)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load selected client details.', 'Close', { duration: 2500 });
          return of(null);
        })
      )
      .subscribe((client) => {
        if (client) {
          this.clientForm.patchValue({
            clientId: client.id,
            clientName: client.fullName,
            phone: client.phone
          });
        }

        this.clientForm.disable({ emitEvent: false });
      });
  }

  private loadClientProfile(clientId: number): void {
    this.isLoadingClientProfile = true;

    this.measurementsService
      .getMeasurementProfile(clientId)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load client measurements.', 'Close', { duration: 2500 });
          return of(null);
        }),
        finalize(() => {
          this.isLoadingClientProfile = false;
        })
      )
      .subscribe((profile) => {
        const valuesByItemType: Record<number, Record<string, number>> = {};
        const allValuesByItemType: Record<number, Record<string, number | string>> = {};
        for (const product of profile?.products ?? []) {
          allValuesByItemType[product.itemTypeId] = product.values ?? {};
          const numericValues = Object.entries(product.values ?? {}).reduce<Record<string, number>>((acc, [key, value]) => {
            const numeric = Number(value);
            if (Number.isFinite(numeric)) {
              acc[key] = numeric;
            }
            return acc;
          }, {});
          valuesByItemType[product.itemTypeId] = numericValues;
        }
        this.clientProfileMeasurementsByItemType = valuesByItemType;
        this.clientProfileAllValuesByItemType = allValuesByItemType;
      });
  }

  protected openAddProductDialog(itemTypeId?: number): void {
    const clientId = this.resolveClientId();
    if (!clientId) {
      this.snackBar.open('Select a client first.', 'Close', { duration: 2500 });
      return;
    }

    const hasSpecificProduct = typeof itemTypeId === 'number' && Number.isInteger(itemTypeId) && itemTypeId > 0;
    const dialogRef = this.dialog.open(ProductMeasurementsDialogComponent, {
      width: '820px',
      maxWidth: '95vw',
      data: {
        itemTypes: this.itemTypes,
        profileValuesByItemType: {
          ...this.clientProfileAllValuesByItemType,
          ...this.draftMeasurementsByItemType
        },
        initialItemTypeId: hasSpecificProduct ? itemTypeId : null,
        initialOrderDetailsByItemType: this.addedProductMeasurements.reduce<
          Record<number, { color?: string | null; material?: string | null }>
        >((acc, product) => {
          acc[product.itemTypeId] = {
            color: product.color,
            material: product.material
          };
          return acc;
        }, {}),
        lockItemTypeSelection: hasSpecificProduct
      }
    });

    dialogRef.afterClosed().subscribe((saved) => {
      if (!saved) {
        return;
      }

      const allValues = saved.values ?? {};
      this.draftMeasurementsByItemType = {
        ...this.draftMeasurementsByItemType,
        [saved.itemTypeId]: allValues
      };
      this.clientProfileAllValuesByItemType = {
        ...this.clientProfileAllValuesByItemType,
        [saved.itemTypeId]: allValues
      };

      const numericValues = Object.entries(allValues).reduce<Record<string, number>>((acc, [key, value]) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          acc[key] = numeric;
        }
        return acc;
      }, {});
      this.clientProfileMeasurementsByItemType = {
        ...this.clientProfileMeasurementsByItemType,
        [saved.itemTypeId]: numericValues
      };

      const valueRows = (saved.fields ?? [])
        .map((field: { key: string; label: string }) => {
          const value = allValues[field.key];
          if (value === null || value === undefined || value === '') {
            return null;
          }
          return {
            key: field.key,
            label: field.label,
            value
          };
        })
        .filter((row: { key: string; label: string; value: number | string } | null): row is { key: string; label: string; value: number | string } => Boolean(row));

      const row: ProductMeasurementRow = {
        itemTypeId: saved.itemTypeId,
        itemTypeName: saved.itemTypeName,
        useCurrentMeasurements: saved.useCurrentMeasurements,
        color: this.cleanOptionalText(saved.color),
        material: this.cleanOptionalText(saved.material),
        values: valueRows
      };

      const existingIndex = this.addedProductMeasurements.findIndex((entry) => entry.itemTypeId === row.itemTypeId);
      if (existingIndex >= 0) {
        const next = [...this.addedProductMeasurements];
        next[existingIndex] = row;
        this.addedProductMeasurements = next;
      } else {
        this.addedProductMeasurements = [...this.addedProductMeasurements, row];
      }

      this.snackBar.open('Product measurements updated in this order draft.', 'Close', { duration: 2000 });
      this.cdr.detectChanges();
    });
  }

  protected editProductMeasurements(itemTypeId: number): void {
    this.openAddProductDialog(itemTypeId);
  }

  private toOrderMeasurementInput(values: Record<string, number | string>): Record<string, number | string> | undefined {
    const entries = Object.entries(values).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return Number.isFinite(Number(value));
    });

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

  private isMeasurementValue(value: number | string): boolean {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    const trimmed = value.trim();
    if (!trimmed.length) {
      return false;
    }

    return Number.isFinite(Number(trimmed));
  }

  private cleanOptionalText(value: unknown): string | null {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length ? trimmed : null;
  }

  private toMissingMeasurementsMessage(err: HttpErrorResponse): string | null {
    const body = err.error as { missingByItem?: Array<{ missingFields: string[] }> } | null;
    if (!body?.missingByItem?.length) {
      return null;
    }

    const allMissing = body.missingByItem.flatMap((item) => item.missingFields);
    const uniqueMissing = Array.from(new Set(allMissing));
    if (!uniqueMissing.length) {
      return null;
    }

    return `Missing required measurements: ${uniqueMissing.join(', ')}`;
  }
}
