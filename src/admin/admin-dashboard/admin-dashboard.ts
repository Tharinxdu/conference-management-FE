// FILE: src/admin/admin-dashboard/admin-dashboard.ts
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { BehaviorSubject, catchError, finalize, map, of, startWith, switchMap } from "rxjs";
import { AdminDashboardService, TAdminDashboardStats } from "../../services/admin-dashboard.service";

// Existing feature pages (they already render <app-page-shell> inside)
import { AdminAbstract } from "../admin-abstract/admin-abstract";
import { CheckIn } from "../check-in/check-in";
import { AdminRegistration } from "../admin-registration/admin-registration";

type TNavKey = "dashboard" | "abstracts" | "checkin" | "registrations";

type TVm = {
  loading: boolean;
  error: string | null;
  data: TAdminDashboardStats | null;
  lastUpdatedIso: string | null;
};

@Component({
  selector: "admin-dashboard",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./admin-dashboard.html",
  styleUrls: ["./admin-dashboard.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  readonly active = signal<TNavKey>("dashboard");
  readonly busy = signal(false);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly viewComponent = computed(() => {
    const key = this.active();
    if (key === "abstracts") return AdminAbstract;
    if (key === "checkin") return CheckIn;
    if (key === "registrations") return AdminRegistration;
    return null;
  });

  readonly stats$ = this.refresh$.pipe(
    switchMap(() =>
      this.admin.getStats().pipe(
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
            "Failed to load dashboard metrics.";
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
    private readonly admin: AdminDashboardService,
    private readonly router: Router
  ) { }

  setActive(key: TNavKey) {
    this.active.set(key);
  }

  refresh() {
    this.refresh$.next();
  }

  logout() {
    if (this.busy()) return;

    this.busy.set(true);
    this.admin
      .logout()
      .pipe(
        catchError(() => of({ ok: true })),
        finalize(() => this.busy.set(false))
      )
      .subscribe(() => {
        this.router.navigateByUrl("/login");
      });
  }

  currencyUsd(amount: number | null | undefined) {
    const n = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }


  pct(n: number, d: number) {
    const denom = d > 0 ? d : 0;
    if (!denom) return "—";
    const v = (n / denom) * 100;
    return `${v.toFixed(1)}%`;
  }

  compact(n: number | null | undefined) {
    const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("en-LK", { notation: "compact" }).format(x);
  }

  trackByIndex(index: number) {
    return index;
  }
}
