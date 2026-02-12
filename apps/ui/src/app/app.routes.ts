import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  {
    path: 'orders',
    loadChildren: () =>
      import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES)
  },
  {
    path: 'clients',
    loadChildren: () =>
      import('./features/clients/clients.routes').then((m) => m.CLIENTS_ROUTES)
  },
  { path: '**', redirectTo: 'orders' }
];
