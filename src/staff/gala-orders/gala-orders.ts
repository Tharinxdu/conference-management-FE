import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { PageShell } from '../../page-shell/page-shell';
import { GalaOrdersService, TGalaOrdersListItem } from '../../services/gala-orders.service';

type TicketRow = {
  ticketId: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  redeemStatus: 'NOT_REDEEMED' | 'REDEEMED';
  redeemedAt?: string | null;
  redeemedByEmail?: string | null;
  expiresAt?: string | null;
};

@Component({
  selector: 'app-gala-orders',
  standalone: true,
  imports: [CommonModule, PageShell],
  templateUrl: './gala-orders.html',
  styleUrls: ['./gala-orders.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalaOrders {
  // pagination/search
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly total = signal(0);

  readonly query = signal('');

  // ✅ DEFAULT: show PAID orders first
  // keep '' as "All statuses" if user selects it
  readonly statusFilter = signal<string>('PAID');

  // list state
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly orders = signal<TGalaOrdersListItem[]>([]);

  // expand state
  readonly expandedId = signal<string | null>(null);
  readonly ticketsBusyId = signal<string | null>(null);
  readonly ticketsErrorId = signal<string | null>(null);
  readonly ticketsErrorMsg = signal<string | null>(null);

  // cache: orderMongoId -> tickets
  readonly ticketMap = signal<Map<string, TicketRow[]>>(new Map());

  constructor(private readonly api: GalaOrdersService) {
    this.load();
  }

  refresh() {
    this.load();
  }

  onQuery(v: string) {
    this.query.set(String(v || '').trim());
    this.page.set(1);
    this.load();
  }

  onStatusFilter(v: string) {
    // '' means "All statuses"
    const s = String(v || '').trim().toUpperCase();
    this.statusFilter.set(s || '');
    this.page.set(1);
    this.load();
  }

  onLimit(v: string) {
    const n = Math.min(100, Math.max(10, Number(v) || 25));
    this.limit.set(n);
    this.page.set(1);
    this.load();
  }

  prevPage() {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.load();
  }

  nextPage() {
    if (this.page() * this.limit() >= this.total()) return;
    this.page.set(this.page() + 1);
    this.load();
  }

  toggleExpand(orderMongoId: string) {
    const current = this.expandedId();
    if (current === orderMongoId) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(orderMongoId);

    // load tickets only if not cached
    if (this.ticketMap().has(orderMongoId)) return;
    this.loadTickets(orderMongoId);
  }

  private load() {
    if (this.busy()) return;

    this.busy.set(true);
    this.loading.set(true);
    this.errorMsg.set(null);

    // collapse on reload
    this.expandedId.set(null);

    // ✅ IMPORTANT: when filter is '', pass null so backend treats it as "no filter"
    const status = (this.statusFilter() || '').trim();
    const paymentStatus = status ? status : null;

    this.api
      .listOrders({
        page: this.page(),
        limit: this.limit(),
        q: this.query(),
        paymentStatus,
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.busy.set(false);
        })
      )
      .subscribe({
        next: (res) => {
          this.total.set(res.total || 0);
          this.orders.set(res.items || []);
        },
        error: (err) => {
          this.errorMsg.set(this.extractError(err));
          this.orders.set([]);
          this.total.set(0);
        },
      });
  }

  private loadTickets(orderMongoId: string) {
    this.ticketsBusyId.set(orderMongoId);
    this.ticketsErrorId.set(null);
    this.ticketsErrorMsg.set(null);

    this.api
      .getOrderTickets(orderMongoId)
      .pipe(finalize(() => this.ticketsBusyId.set(null)))
      .subscribe({
        next: (res) => {
          const tickets = (res.tickets || []).map((t) => ({
            ticketId: t.ticketId,
            status: t.status,
            redeemStatus: t.redeemStatus,
            redeemedAt: t.redeemedAt ?? null,
            redeemedByEmail: t.redeemedByEmail ?? null,
            expiresAt: t.expiresAt ?? null,
          })) as TicketRow[];

          const next = new Map(this.ticketMap());
          next.set(orderMongoId, tickets);
          this.ticketMap.set(next);
        },
        error: (err) => {
          this.ticketsErrorId.set(orderMongoId);
          this.ticketsErrorMsg.set(this.extractError(err));
        },
      });
  }

  trackByIndex(i: number) {
    return i;
  }

  trackByOrderId(_: number, o: TGalaOrdersListItem) {
    return o.galaOrderMongoId;
  }

  trackByTicketId(_: number, t: TicketRow) {
    return t.ticketId;
  }

  private extractError(err: any): string {
    return String(err?.error?.message || err?.message || 'Something went wrong. Please try again.');
  }
}