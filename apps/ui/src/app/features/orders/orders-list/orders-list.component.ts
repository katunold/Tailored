import { DatePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { OrderStatus, ORDER_STATUSES } from '../../../shared/status/status.types';
import { ClientOrderRow, OrdersService } from '../orders.service';

interface OrderRow {
  id: number;
  client: string;
  item: string;
  status: OrderStatus;
  deliveryDate: string | null;
}

@Component({
  selector: 'app-orders-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatProgressSpinnerModule,
    DatePipe,
    PageHeaderComponent,
    StatusChipComponent,
    EmptyStateComponent
  ],
  templateUrl: './orders-list.component.html',
  styleUrl: './orders-list.component.scss'
})
export class OrdersListComponent implements AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  protected readonly quickFilters = ORDER_STATUSES;
  protected readonly displayedColumns = ['id', 'client', 'item', 'status', 'deliveryDate', 'actions'];
  protected isLoading = true;
  protected searchQuery = '';

  private readonly snackBar = inject(MatSnackBar);
  private readonly ordersService = inject(OrdersService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly selectedStatuses = new Set<OrderStatus>();
  private rows: OrderRow[] = [];

  protected readonly dataSource = new MatTableDataSource<OrderRow>([]);

  constructor() {
    this.dataSource.filterPredicate = (row: OrderRow, filter: string): boolean => {
      const parsed = JSON.parse(filter) as { query: string; statuses: OrderStatus[] };

      const matchesQuery =
        !parsed.query ||
        `${row.id} ${row.client} ${row.item}`.toLowerCase().includes(parsed.query.toLowerCase());
      const matchesStatus = parsed.statuses.length === 0 || parsed.statuses.includes(row.status);

      return matchesQuery && matchesStatus;
    };

    this.refresh();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  protected refresh(): void {
    this.isLoading = true;

    this.ordersService
      .getOrders(this.searchQuery)
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load orders from API.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((orders) => {
        this.rows = orders.map((order) => this.toRow(order));
        this.dataSource.data = this.rows;
        this.applyFilters();
      });
  }

  protected onSearch(value: string): void {
    this.searchQuery = value;
    this.applyFilters();
  }

  protected isFilterSelected(status: OrderStatus): boolean {
    return this.selectedStatuses.has(status);
  }

  protected toggleStatus(status: OrderStatus): void {
    if (this.selectedStatuses.has(status)) {
      this.selectedStatuses.delete(status);
    } else {
      this.selectedStatuses.add(status);
    }

    this.applyFilters();
  }

  protected clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatuses.clear();
    this.applyFilters();
  }

  protected deleteOrder(row: OrderRow): void {
    this.ordersService
      .deleteOrder(row.id)
      .pipe(
        catchError(() => {
          this.snackBar.open(`Could not delete order #${row.id}.`, 'Close', { duration: 2500 });
          return of(null);
        })
      )
      .subscribe((result) => {
        if (result === null) {
          return;
        }

        this.snackBar.open(`Deleted order #${row.id}.`, 'Close', { duration: 2200 });
        this.rows = this.rows.filter((order) => order.id !== row.id);
        this.dataSource.data = [...this.rows];
        this.applyFilters();
      });
  }

  protected hasNoResults(): boolean {
    return !this.isLoading && this.dataSource.filteredData.length === 0;
  }

  private applyFilters(): void {
    const filterValue = {
      query: this.searchQuery.trim(),
      statuses: Array.from(this.selectedStatuses)
    };

    this.dataSource.filter = JSON.stringify(filterValue);

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private toRow(order: ClientOrderRow): OrderRow {
    return {
      id: order.id,
      client: order.client,
      item: order.item,
      status: order.status,
      deliveryDate: order.deliveryDate
    };
  }
}
