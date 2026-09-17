// FILE: src/admin/admin-registration/admin-registration.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RegistrationsDirectory } from '../../shared/registrations-directory/registrations-directory';

/**
 * Admin "Registrations" tab.
 *
 * Thin host around the shared directory so the admin dashboard can keep
 * rendering it through *ngComponentOutlet (which passes no inputs) while the
 * scope stays explicit.
 */
@Component({
  selector: 'app-admin-registration',
  standalone: true,
  imports: [RegistrationsDirectory],
  templateUrl: './admin-registration.html',
  styleUrl: './admin-registration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRegistration {}
