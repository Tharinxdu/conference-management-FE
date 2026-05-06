// FILE: src/staff/staff-dashboard/staff-dashboard.ts
import { ChangeDetectionStrategy, Component, Type, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';
import { StaffGalaDashboardService, TGalaStaffStats } from '../../services/staff-gala-dashboard.service';

// ✅ Feature components
import { GalaCheckIn } from '../gala-check-in/gala-check-in';
import { GalaOrders } from '../gala-orders/gala-orders';

type TNavKey = 'dashboard' | 'gala-redeem' | 'gala-orders';

type TVm = {
  loading: boolean;
  error: string | null;
  data: TGalaStaffStats | null;
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

  /**
   * ✅ IMPORTANT FIX:
   * Tell TS this can return ANY Angular component Type, not just GalaCheckIn.
   */
  readonly viewComponent = computed<Type<any> | null>(() => {
    const key = this.active();
    if (key === 'gala-redeem') return GalaCheckIn;
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
    private readonly router: Router
  ) {}

  setActive(key: TNavKey) {
    this.active.set(key);
  }

  refresh() {
    this.refresh$.next();
  }

  logout() {
    if (this.busy()) return;

    this.busy.set(true);
    this.staff
      .logout()
      .pipe(
        catchError(() => of(void 0)),
        finalize(() => this.busy.set(false))
      )
      .subscribe(() => {
        // ✅ Your auth route is /auth
        this.router.navigateByUrl('/auth');
      });
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