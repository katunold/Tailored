import { AfterViewInit, ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, of } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ClientDto, ClientsService } from '../clients.service';

interface ClientRow {
  id: number;
  fullName: string;
  phone: string;
  createdOn: string;
  updatedAt: string;
}

@Component({
  selector: 'app-clients-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
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

  protected readonly displayedColumns = ['fullName', 'phone', 'createdOn', 'updatedAt', 'actions'];
  protected isLoading = true;
  protected searchQuery = '';

  private readonly snackBar = inject(MatSnackBar);
  private readonly clientsService = inject(ClientsService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly dataSource = new MatTableDataSource<ClientRow>([]);

  constructor() {
    this.dataSource.filterPredicate = (row, filter) => {
      const q = filter.trim().toLowerCase();
      return !q || `${row.id} ${row.fullName} ${row.phone} ${row.createdOn}`.toLowerCase().includes(q);
    };

    this.refresh();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  protected refresh(): void {
    this.isLoading = true;

    this.clientsService
      .getClients()
      .pipe(
        catchError(() => {
          this.snackBar.open('Could not load clients from API.', 'Close', { duration: 2500 });
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((clients) => {
        this.dataSource.data = clients.map((client) => this.toRow(client));
        this.applySearch(this.searchQuery);
        this.cdr.detectChanges();
      });
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

  protected placeOrder(client: ClientRow): void {
    this.router.navigate(['/orders/new'], { queryParams: { clientId: client.id } });
  }

  protected hasNoResults(): boolean {
    return !this.isLoading && this.dataSource.filteredData.length === 0;
  }

  private toRow(client: ClientDto): ClientRow {
    return {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      createdOn: new Date(client.createdAt).toLocaleDateString(),
      updatedAt: new Date(client.updatedAt).toLocaleDateString()
    };
  }
}
