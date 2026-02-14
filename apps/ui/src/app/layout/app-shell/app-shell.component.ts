import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  take
} from 'rxjs';
import { ClientDto, ClientsService } from '../../features/clients/clients.service';
import { ClientOrderRow, OrdersService } from '../../features/orders/orders.service';

interface SearchEntry {
  label: string;
  subtitle: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatAutocompleteModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly clientsService = inject(ClientsService);
  private readonly ordersService = inject(OrdersService);
  protected readonly isMobile$ = this.breakpointObserver.observe('(max-width: 960px)').pipe(
    map((result) => result.matches),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  protected readonly searchControl = new FormControl<string | SearchEntry>('', {
    nonNullable: true
  });

  protected readonly filteredResults$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    map((value) => (typeof value === 'string' ? value.trim() : '')),
    debounceTime(200),
    distinctUntilChanged(),
    switchMap((query) => this.searchEntries(query))
  );

  protected displaySearch(value: string | SearchEntry | null): string {
    if (!value) {
      return '';
    }

    return typeof value === 'string' ? value : value.label;
  }

  protected onSearchSubmit(event: Event): void {
    event.preventDefault();

    const raw = this.searchControl.value;

    if (typeof raw !== 'string') {
      this.goToResult(raw);
      return;
    }

    const query = raw.trim();
    if (!query) {
      return;
    }

    this.searchEntries(query)
      .pipe(take(1))
      .subscribe((results) => {
        const [firstMatch] = results;
        if (!firstMatch) {
          this.snackBar.open('No matching client or order found.', 'Close', {
            duration: 2200
          });
          return;
        }

        this.goToResult(firstMatch);
      });
  }

  protected goToResult(result: SearchEntry): void {
    this.router.navigateByUrl(result.route);
    this.searchControl.setValue('');
  }

  protected closeSidenavOnMobile(sidenav: MatSidenav): void {
    this.isMobile$.pipe(take(1)).subscribe((isMobile) => {
      if (isMobile) {
        sidenav.close();
      }
    });
  }

  private searchEntries(query: string) {
    if (!query) {
      return of([] as SearchEntry[]);
    }

    return forkJoin({
      clients: this.clientsService.getClients(query).pipe(catchError(() => of([] as ClientDto[]))),
      orders: this.ordersService.getOrders(query).pipe(catchError(() => of([] as ClientOrderRow[])))
    }).pipe(
      map(({ clients, orders }) => [
        ...orders.slice(0, 5).map((order) => this.toOrderSearchEntry(order)),
        ...clients.slice(0, 5).map((client) => this.toClientSearchEntry(client))
      ])
    );
  }

  private toOrderSearchEntry(order: ClientOrderRow): SearchEntry {
    return {
      label: `Order #${order.id}`,
      subtitle: `${order.client} - ${order.item}`,
      route: `/orders/${order.id}`
    };
  }

  private toClientSearchEntry(client: ClientDto): SearchEntry {
    return {
      label: client.fullName,
      subtitle: `Client #${client.id} - ${client.phone}`,
      route: `/clients/${client.id}`
    };
  }
}
