// FILE: src/staff/staff-dashboard/staff-dashboard.ts
import { ChangeDetectionStrategy, Component, Type, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
  StaffGalaDashboardService,
  type TStaffActivityEntry,
  type TStaffDashboardStats,
} from '../../services/staff-gala-dashboard.service';

// ✅ Feature components
import { CheckInConsole } from '../../shared/check-in-console/check-in-console';
import { StaffRegistrations } from '../staff-registrations/staff-registrations';
import { GalaOrders } from '../gala-orders/gala-orders';

type TNavKey = 'dashboard' | 'checkin' | 'registrations' | 'gala-orders';

type TVm = {
  loading: boolean;
  error: string | null;
  data: TStaffDashboardStats | null;
  lastUpdatedIso: string | null;
};

@Component({
  selector: 'staff-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './staff-dashboard.html',
  styleUrls: ['./staff-dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffDashboard {
  readonly active = signal<TNavKey>('dashboard');
  readonly busy = signal(false);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  /** Any Angular component type — each feature view renders its own page shell. */
  readonly viewComponent = computed<Type<any> | null>(() => {
    const key = this.active();
    if (key === 'checkin') return CheckInConsole;
    if (key === 'registrations') return StaffRegistrations;
    if (key === 'gala-orders') return GalaOrders;
    return null; // dashboard view is inside this component
  });

  readonly stats$ = this.refresh$.pipe(
    switchMap(() =>
      this.staff.getStats().pipe(
        map((data): TVm => ({
          loading: false,
          error: null,
          data,
          lastUpdatedIso: new Date().toISOString(),
        })),
        startWith({
          loading: true,
          error: null,
          data: null,
          lastUpdatedIso: null,
        } as TVm),
        catchError((err) => {
          const msg =
            err?.error?.message ||
            err?.message ||
            'Failed to load staff dashboard metrics.';
          return of({
            loading: false,
            error: String(msg),
            data: null,
            lastUpdatedIso: null,
          } as TVm);
        })
      )
    )
  );

  constructor(
    private readonly staff: StaffGalaDashboardService,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  setActive(key: TNavKey) {
    this.active.set(key);
  }

  refresh() {
    this.refresh$.next();
  }

  /**
   * Log out through AuthService so its cached user is cleared. Posting to the
   * logout endpoint directly left that cache populated, and authRedirectGuard
   * then bounced the user straight back into the dashboard.
   */
  logout() {
    if (this.busy()) return;

    this.busy.set(true);
    this.auth
      .logout()
      .pipe(
        catchError(() => of(void 0)),
        finalize(() => this.busy.set(false))
      )
      .subscribe(() => {
        this.router.navigateByUrl('/auth');
      });
  }

  /**
   * Defensive read of the activity feed: an older backend build can omit it,
   * and a missing array here used to take the whole dashboard down.
   */
  activityRows(d: TStaffDashboardStats): TStaffActivityEntry[] {
    return d?.recentActivity ?? [];
  }

  /** Label for one row of the merged activity feed. */
  activityIcon(entry: TStaffActivityEntry) {
    return entry.type === 'CHECK_IN' ? '🎫' : '🍽️';
  }

  activityVerb(entry: TStaffActivityEntry) {
    return entry.type === 'CHECK_IN' ? 'Checked in' : 'Redeemed';
  }

  activityWhere(entry: TStaffActivityEntry) {
    return entry.type === 'CHECK_IN' ? 'Conference' : 'Gala dinner';
  }

  trackByActivity(_: number, entry: TStaffActivityEntry) {
    return `${entry.type}:${entry.primaryId}:${entry.at}`;
  }

  pct(n: number, d: number) {
    const denom = d > 0 ? d : 0;
    if (!denom) return '—';
    return `${((n / denom) * 100).toFixed(1)}%`;
  }

  compact(n: number | null | undefined) {
    const x = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-LK', { notation: 'compact' }).format(x);
  }

  trackByIndex(i: number) {
    return i;
  }
}