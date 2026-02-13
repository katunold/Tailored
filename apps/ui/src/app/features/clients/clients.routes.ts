import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./clients-list/clients-list.component').then((m) => m.ClientsListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./client-create/client-create.component').then((m) => m.ClientCreateComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./client-details/client-details.component').then((m) => m.ClientDetailsComponent)
  }
];
