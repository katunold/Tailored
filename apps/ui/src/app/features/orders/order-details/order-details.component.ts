import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import {
  BackendOrderStatus,
  OrderDetails,
  OrdersService
} from '../orders.service';

type StatusOption = {
  value: BackendOrderStatus;
  label: string;
};

@Component({
  selector: 'app-order-details',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    DatePipe,
    PageHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss'
})
export class OrderDetailsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(OrdersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  protected isLoading = true;
  protected loadFailed = false;
  protected isUpdatingStatus = false;
  protected orderId: number | null = null;
  protected order: OrderDetails | null = null;
  protected readonly displayedColumns = ['itemName', 'quantity', 'color', 'material', 'measurements'];
  private readonly templateKeysByItemTypeId = new Map<number, string[]>();
  private isPatchingStatus = false;

  protected readonly statusOptions: StatusOption[] = [
    { value: 'PLACED', label: 'Placed' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'PAUSED', label: 'Paused' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELED', label: 'Canceled' }
  ];

  protected readonly statusForm = this.fb.group({
    status: ['PLACED' as BackendOrderStatus, Validators.required]
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.isLoading = false;
      this.loadFailed = true;
      return;
    }

    this.orderId = id;
    this.loadOrder(id);
  }

  protected hasOrderItems(): boolean {
    return (this.order?.items?.length ?? 0) > 0;
  }

  protected measurementPairs(item: OrderDetails['items'][number]): Array<{ key: string; value: number }> {
    const templateKeys = this.templateKeysByItemTypeId.get(item.itemTypeId) ?? [];

    if (templateKeys.length > 0) {
      return templateKeys
        .filter((key) => item.measurements[key] !== undefined && item.measurements[key] !== null)
        .map((key) => ({ key, value: Number(item.measurements[key]) }))
        .filter((pair) => Number.isFinite(pair.value));
    }

    return Object.entries(item.measurements)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }));
  }

  protected onStatusChanged(nextStatus: BackendOrderStatus): void {
    if (!this.orderId || this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      return;
    }

    if (!nextStatus || !this.order || this.isPatchingStatus) {
      return;
    }

    const previousStatus = this.order.status;
    if (previousStatus === nextStatus) {
      return;
    }

    this.isUpdatingStatus = true;
    this.ordersService
      .updateOrderStatus(this.orderId, nextStatus)
      .pipe(
        catchError(() => {
          this.isPatchingStatus = true;
          this.statusForm.patchValue({ status: previousStatus }, { emitEvent: false });
          this.isPatchingStatus = false;
          this.snackBar.open('Could not update order status.', 'Close', { duration: 2500 });
          return of(null);
        }),
        finalize(() => {
          this.isUpdatingStatus = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((result) => {
        if (result === null || !this.order) {
          return;
        }

        this.order = { ...this.order, status: nextStatus };
        this.snackBar.open('Order status updated.', 'Close', { duration: 1800 });
      });
  }

  private loadOrder(id: number): void {
    this.isLoading = true;
    this.loadFailed = false;

    this.ordersService
      .getOrderById(id)
      .pipe(
        catchError(() => {
          this.loadFailed = true;
          this.snackBar.open('Could not load order details.', 'Close', { duration: 2500 });
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((order) => {
        if (!order) {
          this.order = null;
          return;
        }

        this.order = order;
        this.templateKeysByItemTypeId.clear();
        this.loadTemplatesForItems(order.items.map((item) => item.itemTypeId));
        this.isPatchingStatus = true;
        this.statusForm.patchValue({ status: order.status }, { emitEvent: false });
        this.isPatchingStatus = false;
      });
  }

  private loadTemplatesForItems(itemTypeIds: number[]): void {
    const uniqueIds = Array.from(new Set(itemTypeIds));
    if (uniqueIds.length === 0) {
      return;
    }

    forkJoin(
      uniqueIds.map((itemTypeId) =>
        this.ordersService.getItemTypeTemplate(itemTypeId).pipe(catchError(() => of([])))
      )
    ).subscribe((templates) => {
      uniqueIds.forEach((itemTypeId, index) => {
        const keys = (templates[index] ?? []).map((field) => field.key);
        this.templateKeysByItemTypeId.set(itemTypeId, keys);
      });
      this.cdr.detectChanges();
    });
  }
}
