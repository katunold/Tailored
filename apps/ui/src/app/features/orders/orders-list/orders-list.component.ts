import { AfterViewInit, Component, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { OrderStatus, ORDER_STATUSES } from '../../../shared/status/status.types';

interface OrderRow {
  id: string;
  client: string;
  item: string;
  status: OrderStatus;
  deliveryDate: string;
}

@Component({
  selector: 'app-orders-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatProgressSpinnerModule,
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
  private readonly selectedStatuses = new Set<OrderStatus>();

  private rows: OrderRow[] = [
    { id: 'ORD-1042', client: 'Avery Cole', item: 'Wedding suit', status: 'In Progress', deliveryDate: '2026-02-20' },
    { id: 'ORD-1043', client: 'Mina Aziz', item: 'Evening gown', status: 'Fitting', deliveryDate: '2026-02-22' },
    { id: 'ORD-1044', client: 'Theo Kim', item: 'Shirt x2', status: 'Ready', deliveryDate: '2026-02-18' },
    { id: 'ORD-1045', client: 'Lina Gray', item: 'Reception dress', status: 'New', deliveryDate: '2026-02-28' },
    { id: 'ORD-1046', client: 'Jon Park', item: 'Suit alteration', status: 'Delivered', deliveryDate: '2026-02-10' }
  ];

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

    setTimeout(() => {
      this.dataSource.data = this.rows;
      this.applyFilters();
      this.isLoading = false;
    }, 250);
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

  protected advanceStatus(row: OrderRow): void {
    const previous = row.status;
    const next = this.getNextStatus(previous);

    if (!next) {
      this.snackBar.open(`Order ${row.id} is already in a terminal status.`, 'Close', {
        duration: 2500
      });
      return;
    }

    row.status = next;
    this.dataSource.data = [...this.rows];
    this.applyFilters();

    const ref = this.snackBar.open(`Moved ${row.id} to ${next}`, 'Undo', {
      duration: 4000
    });

    ref.onAction().subscribe(() => {
      row.status = previous;
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

  private getNextStatus(status: OrderStatus): OrderStatus | null {
    const flow: Record<OrderStatus, OrderStatus | null> = {
      New: 'In Progress',
      'In Progress': 'Fitting',
      Fitting: 'Ready',
      Ready: 'Delivered',
      Delivered: null,
      Cancelled: null
    };

    return flow[status];
  }
}
