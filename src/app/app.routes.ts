import { Routes } from '@angular/router';
import { adminGuard, authGuard, authRedirectGuard, staffGuard } from '../auth/auth.guard';
import { Registration } from '../registration/registration';

// ✅ NEW: Gala Dinner pages (standalone components)
import { GalaTickets } from '../gala-tickets/gala-tickets';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth' },

  {
    path: 'auth',
    canActivate: [authRedirectGuard],
    loadComponent: () =>
      import('../auth/auth-component/auth-component').then((m) => m.AuthComponent),
  },

  {
    path: 'reset-password',
    loadComponent: () =>
      import('../auth/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
  },

  // Registration form page
  { path: 'registration', component: Registration },

  {
    path: 'registration-status',
    loadComponent: () =>
      import('../registration/registration-status/registration-status').then(
        (m) => m.RegistrationStatus
      ),
  },

  // ✅ NEW: Gala Dinner tickets form (PUBLIC - no guards)
  { path: 'gala-dinner', component: GalaTickets },

  // ✅ NEW: Gala Dinner OnePay redirect/return page (PUBLIC - no guards)
  {
    path: 'gala-status',
    loadComponent: () =>
      import('../gala-tickets/gala-status/gala-status').then((m) => m.GalaStatus),
  },

  {
    path: 'abstract-dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../abstract/abstract-dashboard/abstract-dashboard').then(
        (m) => m.AbstractDashboard
      ),
  },

  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('../admin/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
  },

  {
    path: 'staff',
    canActivate: [authGuard, staffGuard],
    loadComponent: () =>
      import('../staff/staff-dashboard/staff-dashboard').then((m) => m.StaffDashboard),
  },

  { path: '**', redirectTo: 'auth' },
];