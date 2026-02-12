import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map, startWith } from 'rxjs';

interface SearchEntry {
  label: string;
  subtitle: string;
  route: string;
  tokens: string[];
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

  private readonly searchEntries: SearchEntry[] = [
    {
      label: 'ORD-1042',
      subtitle: 'Order - Avery Cole',
      route: '/orders/ORD-1042',
      tokens: ['ord-1042', 'avery', 'cole', 'wedding suit']
    },
    {
      label: 'ORD-1043',
      subtitle: 'Order - Mina Aziz',
      route: '/orders/ORD-1043',
      tokens: ['ord-1043', 'mina', 'aziz', 'evening gown']
    },
    {
      label: 'CL-101',
      subtitle: 'Client - Avery Cole - +1 555 0121',
      route: '/clients/CL-101',
      tokens: ['cl-101', 'avery', 'cole', '555', '0121']
    },
    {
      label: 'CL-102',
      subtitle: 'Client - Mina Aziz - +1 555 0155',
      route: '/clients/CL-102',
      tokens: ['cl-102', 'mina', 'aziz', '555', '0155']
    }
  ];

  protected readonly searchControl = new FormControl<string | SearchEntry>('', {
    nonNullable: true
  });

  protected readonly filteredResults$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    map((value) => (typeof value === 'string' ? value : value?.label ?? '')),
    map((query) => this.filterEntries(query))
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

    const [firstMatch] = this.filterEntries(raw);

    if (!firstMatch) {
      this.snackBar.open('No matching client or order found.', 'Close', {
        duration: 2200
      });
      return;
    }

    this.goToResult(firstMatch);
  }

  protected goToResult(result: SearchEntry): void {
    this.router.navigateByUrl(result.route);
    this.searchControl.setValue('');
  }

  private filterEntries(query: string): SearchEntry[] {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return this.searchEntries;
    }

    return this.searchEntries.filter((entry) => {
      const text = `${entry.label} ${entry.subtitle} ${entry.tokens.join(' ')}`.toLowerCase();
      return text.includes(normalized);
    });
  }
}
