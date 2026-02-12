import { AfterViewInit, Component, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  activeOrders: number;
  lastVisit: string;
}

@Component({
  selector: 'app-clients-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './clients-list.component.html',
  styleUrl: './clients-list.component.scss'
})
export class ClientsListComponent implements AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  protected readonly displayedColumns = ['name', 'phone', 'email', 'activeOrders', 'lastVisit', 'actions'];
  protected isLoading = true;
  protected searchQuery = '';

  private readonly snackBar = inject(MatSnackBar);
  private readonly rows: ClientRow[] = [
    { id: 'CL-101', name: 'Avery Cole', phone: '+1 555 0121', email: 'avery@example.com', activeOrders: 2, lastVisit: '2026-02-06' },
    { id: 'CL-102', name: 'Mina Aziz', phone: '+1 555 0155', email: 'mina@example.com', activeOrders: 1, lastVisit: '2026-02-09' },
    { id: 'CL-103', name: 'Theo Kim', phone: '+1 555 0148', email: 'theo@example.com', activeOrders: 0, lastVisit: '2026-01-30' },
    { id: 'CL-104', name: 'Sarah Khan', phone: '+1 555 0188', email: 'sarah@example.com', activeOrders: 3, lastVisit: '2026-02-10' }
  ];

  protected readonly dataSource = new MatTableDataSource<ClientRow>([]);

  constructor() {
    this.dataSource.filterPredicate = (row, filter) => {
      const q = filter.trim().toLowerCase();
      return !q || `${row.id} ${row.name} ${row.phone} ${row.email}`.toLowerCase().includes(q);
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
      this.applySearch(this.searchQuery);
      this.isLoading = false;
    }, 200);
  }

  protected applySearch(query: string): void {
    this.searchQuery = query;
    this.dataSource.filter = query;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  protected clearSearch(): void {
    this.applySearch('');
  }

  protected quickCall(client: ClientRow): void {
    this.snackBar.open(`Calling ${client.name} at ${client.phone}...`, 'Close', { duration: 1800 });
  }

  protected hasNoResults(): boolean {
    return !this.isLoading && this.dataSource.filteredData.length === 0;
  }
}
