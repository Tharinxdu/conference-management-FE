// FILE: src/staff/staff-registrations/staff-registrations.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RegistrationsDirectory } from '../../shared/registrations-directory/registrations-directory';

/**
 * Staff "Registrations" tab — same directory as admin, minus the Excel export
 * (the shared component hides it for the staff scope, and the staff API has no
 * export route).
 */
@Component({
  selector: 'app-staff-registrations',
  standalone: true,
  imports: [RegistrationsDirectory],
  templateUrl: './staff-registrations.html',
  styleUrl: './staff-registrations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffRegistrations {}
