import { Routes } from '@angular/router';
import { adminGuard, authGuard, authRedirectGuard } from '../auth/auth.guard';
import { Registration } from '../registration/registration';

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

  // ✅ OnePay redirect/return page (payment status page)
  {
    path: 'registration-status',
    loadComponent: () =>
      import('../registration/registration-status/registration-status').then(
        (m) => m.RegistrationStatus
      ),
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

  { path: '**', redirectTo: 'auth' },
];
