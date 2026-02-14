import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { catchError, finalize, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { MeasurementsService } from '../../clients/measurements.service';
import { ClientsService } from '../../clients/clients.service';
import {
  CreateOrderPayload,
  OrderItemTemplateField,
  OrderItemType,
  OrdersService
} from '../orders.service';

@Component({
  selector: 'app-order-wizard',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatStepperModule,
    DatePipe,
    PageHeaderComponent
  ],
  templateUrl: './order-wizard.component.html',
  styleUrl: './order-wizard.component.scss'
})
export class OrderWizardComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;

  private readonly fb = inject(FormBuilder);
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
  protected isLoadingTemplate = false;
  protected isLoadingClientProfile = false;
  protected isLoadingClients = false;
  protected isCreatingClient = false;
  protected showNewClientForm = false;

  protected scopedClientId: number | null = null;
  protected itemTypes: OrderItemType[] = [];
  protected clients: Array<{ id: number; fullName: string; phone: string; notes: string | null }> = [];
  protected filteredClients: Array<{ id: number; fullName: string; phone: string; notes: string | null }> = [];
  protected clientSearchTerm = '';
  protected selectedItemTypeName = '';
  protected selectedTemplateFields: OrderItemTemplateField[] = [];
  protected clientProfileMeasurements: Record<string, number> = {};
  protected addedItems: CreateOrderPayload['items'] = [];

  protected readonly clientForm = this.fb.group({
    clientId: [null as number | null, Validators.required],
    clientName: [''],
    phone: ['']
  });
  protected readonly newClientForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', Validators.required],
    notes: ['']
  });

  protected readonly orderForm = this.fb.group({
    itemTypeId: [null as number | null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    color: [''],
    material: [''],
    dueDate: [null as Date | null, Validators.required],
    notes: ['']
  });

  protected readonly measurementModeForm = this.fb.group({
    useCurrentMeasurements: [true]
  });

  protected readonly measurementForm = this.fb.group({});

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
        this.clientProfileMeasurements = {};
        this.applyProfileValuesToMeasurementForm();
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
      this.loadClientProfile(selectedClient.id);
    });

    this.orderForm.controls.itemTypeId.valueChanges.subscribe((itemTypeId) => {
      if (!itemTypeId) {
        this.selectedItemTypeName = '';
        this.selectedTemplateFields = [];
        this.resetMeasurementForm();
        return;
      }

      const match = this.itemTypes.find((itemType) => itemType.id === itemTypeId);
      this.selectedItemTypeName = match?.name ?? '';
      this.loadTemplateFields(itemTypeId);
    });

    this.measurementModeForm.controls.useCurrentMeasurements.valueChanges.subscribe((useCurrent) => {
      if (useCurrent) {
        this.applyProfileValuesToMeasurementForm();
      }
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

    this.isSubmitting = true;
    const currentItem = this.buildOrderItemPayload();

    const payload: CreateOrderPayload = {
      clientId,
      status: 'PLACED',
      dueDate: this.orderForm.value.dueDate?.toISOString(),
      notes: this.orderForm.value.notes?.trim() || null,
      items: [...this.addedItems, currentItem]
    };

    this.ordersService
      .createOrder(payload)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const missingMessage = this.toMissingMeasurementsMessage(err);
          this.snackBar.open(missingMessage ?? 'Could not create order.', 'Close', { duration: 3500 });
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

  protected addCurrentItem(): void {
    if (!this.validateBeforeSubmit()) {
      return;
    }

    this.addedItems = [...this.addedItems, this.buildOrderItemPayload()];
    this.snackBar.open('Item added to order. Configure the next item.', 'Close', { duration: 2000 });
    this.prepareForNextItem();
  }

  protected removeAddedItem(index: number): void {
    this.addedItems = this.addedItems.filter((_, i) => i !== index);
  }

  protected totalItemsInOrder(): number {
    return this.addedItems.length + 1;
  }

  protected itemTypeName(itemTypeId: number): string {
    return this.itemTypes.find((itemType) => itemType.id === itemTypeId)?.name ?? 'N/A';
  }

  protected itemMeasurementMode(item: CreateOrderPayload['items'][number]): string {
    if (item.useCurrentMeasurements) {
      return 'Current profile measurements';
    }
    return 'Manual measurements';
  }

  protected measurementFieldLabel(field: OrderItemTemplateField): string {
    return `${field.label}${field.required ? ' *' : ''}`;
  }

  protected isMeasurementFieldReadOnly(field: OrderItemTemplateField): boolean {
    const useCurrent = this.measurementModeForm.value.useCurrentMeasurements ?? true;
    if (!useCurrent) {
      return false;
    }

    return this.hasProfileValue(field.key);
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

  protected canGoNext(): boolean {
    const clientStepIndex = 0;
    const orderStepIndex = 1;
    const measurementStepIndex = 2;

    if (this.isSubmitting || this.isLoadingClients || this.isCreatingClient) {
      return false;
    }

    if (this.currentStep === clientStepIndex) {
      return this.clientForm.valid;
    }

    if (this.currentStep === orderStepIndex) {
      if (this.isLoadingItemTypes) {
        return false;
      }
      return this.orderForm.valid;
    }

    if (this.currentStep === measurementStepIndex) {
      if (this.isLoadingTemplate || this.isLoadingClientProfile) {
        return false;
      }
      return this.areRequiredMeasurementsSatisfied();
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
    this.clientProfileMeasurements = {};
    this.applyProfileValuesToMeasurementForm();
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

  private loadTemplateFields(itemTypeId: number): void {
    this.isLoadingTemplate = true;
    this.resetMeasurementForm();

    this.ordersService
      .getItemTypeTemplate(itemTypeId)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load measurement template.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isLoadingTemplate = false;
        })
      )
      .subscribe((fields) => {
        this.selectedTemplateFields = fields.filter((field) => field.type === 'number');

        for (const field of this.selectedTemplateFields) {
          const profileValue =
            field.key in this.clientProfileMeasurements ? this.clientProfileMeasurements[field.key] : null;
          this.measurementForm.addControl(field.key, this.fb.control<number | null>(profileValue));
        }
      });
  }

  private resetMeasurementForm(): void {
    for (const key of Object.keys(this.measurementForm.controls)) {
      this.measurementForm.removeControl(key);
    }
  }

  private canProceedFromCurrentStep(): boolean {
    if (this.canGoNext()) {
      return true;
    }

    if (this.currentStep === 0) {
      this.clientForm.markAllAsTouched();
    } else if (this.currentStep === 1) {
      this.orderForm.markAllAsTouched();
    } else if (this.currentStep === 2) {
      this.measurementForm.markAllAsTouched();
    }

    return false;
  }

  private validateBeforeSubmit(): boolean {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return false;
    }

    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return false;
    }

    if (this.measurementModeForm.invalid) {
      this.measurementModeForm.markAllAsTouched();
      return false;
    }

    return true;
  }

  private prepareForNextItem(): void {
    const dueDate = this.orderForm.getRawValue().dueDate;
    const notes = this.orderForm.getRawValue().notes ?? '';

    this.orderForm.reset({
      itemTypeId: null,
      quantity: 1,
      color: '',
      material: '',
      dueDate,
      notes
    });
    this.measurementModeForm.patchValue({ useCurrentMeasurements: true });
    this.selectedItemTypeName = '';
    this.selectedTemplateFields = [];
    this.resetMeasurementForm();

    this.currentStep = 1;
    this.stepper.selectedIndex = 1;
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
        this.clientProfileMeasurements = profile?.values ?? {};
        this.applyProfileValuesToMeasurementForm();
      });
  }

  private applyProfileValuesToMeasurementForm(): void {
    if (Object.keys(this.measurementForm.controls).length === 0) {
      return;
    }

    const patch: Record<string, number | null> = {};

    for (const field of this.selectedTemplateFields) {
      patch[field.key] =
        field.key in this.clientProfileMeasurements ? this.clientProfileMeasurements[field.key] : null;
    }

    this.measurementForm.patchValue(patch);
  }

  private areRequiredMeasurementsSatisfied(): boolean {
    for (const field of this.selectedTemplateFields) {
      if (!field.required) {
        continue;
      }

      const raw = this.measurementForm.get(field.key)?.value;
      if (raw === null || raw === undefined || raw === '') {
        return false;
      }

      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        return false;
      }
    }

    return true;
  }

  private buildOrderItemPayload(): CreateOrderPayload['items'][number] {
    const useCurrent = this.measurementModeForm.value.useCurrentMeasurements ?? true;
    const itemTypeId = this.orderForm.value.itemTypeId ?? 0;
    const quantity = Number(this.orderForm.value.quantity ?? 1);
    const color = this.orderForm.value.color?.trim() ?? '';
    const material = this.orderForm.value.material?.trim() ?? '';

    if (useCurrent) {
      const additions = this.toProfileFillInsInput();
      const hasAdditions = Object.keys(additions).length > 0;

      return {
        itemTypeId,
        quantity,
        color,
        material,
        useCurrentMeasurements: true,
        ...(hasAdditions ? { measurementsInput: additions } : {})
      };
    }

    return {
      itemTypeId,
      quantity,
      color,
      material,
      useCurrentMeasurements: false,
      measurementsInput: this.toMeasurementInput()
    };
  }

  private toMeasurementInput(): Record<string, number> {
    const values: Record<string, number> = {};

    for (const field of this.selectedTemplateFields) {
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

  private toProfileFillInsInput(): Record<string, number> {
    const values: Record<string, number> = {};

    for (const field of this.selectedTemplateFields) {
      if (this.hasProfileValue(field.key)) {
        continue;
      }

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

  private hasProfileValue(fieldKey: string): boolean {
    const value = this.clientProfileMeasurements[fieldKey];
    return value !== null && value !== undefined && Number.isFinite(Number(value));
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
