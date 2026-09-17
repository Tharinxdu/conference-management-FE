// FILE: src/staff/gala-orders/gala-orders.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageShell } from '../../page-shell/page-shell';
import { AuthService } from '../../services/auth.service';
import {
  GalaOrdersService,
  type TGalaOrderSortKey,
  type TGalaOrdersListItem,
  type TGalaOrdersQuery,
  type TGalaOrdersSummary,
  type TGalaTicketRow,
  type TSortDir,
} from '../../services/gala-orders.service';

const SEARCH_DEBOUNCE_MS = 280;
const DEFAULT_LIMIT = 25;
/** How long the success panel stays up before the modal gets out of the way. */
const AUTO_CLOSE_MS = 2400;

/** What the confirmation modal is about to redeem. */
type TRedeemTarget =
  | { kind: 'next'; order: TGalaOrdersListItem }
  | { kind: 'ticket'; order: TGalaOrdersListItem; ticket: TGalaTicketRow };

/** Outcome shown in the modal after a successful redemption. */
type TRedeemOutcome = {
  headline: string;
  primaryId: string;
  title: string;
  detail: string;
  alreadyDone: boolean;
  at: string;
};

/**
 * Gala orders directory — the same shape as the registrations directory:
 * summary, debounced search, sortable columns, expandable detail, a per-row
 * action behind a confirmation modal, and a pager.
 *
 * PAID only: an unpaid order has no valid coupons, so it has no place at the
 * door.
 */
@Component({
  selector: 'app-gala-orders',
  standalone: true,
  imports: [CommonModule, PageShell],
  templateUrl: './gala-orders.html',
  styleUrl: './gala-orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalaOrders implements OnInit {
  private readonly api = inject(GalaOrdersService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // ----- query state -----
  readonly page = signal(1);
  readonly limit = signal(DEFAULT_LIMIT);
  readonly query = signal('');
  readonly sortBy = signal<TGalaOrderSortKey>('buyerName');
  readonly sortDir = signal<TSortDir>('asc');

  // ----- result state -----
  readonly rows = signal<TGalaOrdersListItem[]>([]);
  readonly total = signal(0);
  readonly summary = signal<TGalaOrdersSummary>({
    orders: 0,
    tickets: 0,
    redeemed: 0,
    remaining: 0,
  });

  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly infoMsg = signal<string | null>(null);

  // ----- row interaction state -----
  readonly expandedId = signal<string | null>(null);
  readonly ticketMap = signal<Map<string, TGalaTicketRow[]>>(new Map());
  readonly ticketsBusyId = signal<string | null>(null);
  readonly ticketsErrorId = signal<string | null>(null);
  readonly ticketsErrorMsg = signal<string | null>(null);

  readonly redeemTarget = signal<TRedeemTarget | null>(null);
  readonly redeemBusy = signal(false);
  readonly redeemError = signal<string | null>(null);
  /** Set once a redemption succeeds — the modal switches to a success panel. */
  readonly redeemResult = signal<TRedeemOutcome | null>(null);

  readonly hasRows = computed(() => this.rows().length > 0);
  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly rangeStart = computed(() => (this.total() ? (this.page() - 1) * this.limit() + 1 : 0));
  readonly rangeEnd = computed(() => Math.min(this.page() * this.limit(), this.total()));

  readonly redeemedPct = computed(() => {
    const s = this.summary();
    if (!s.tickets) return 0;
    return Math.round((s.redeemed / s.tickets) * 100);
  });

  /** Stale-response guard: only the newest request may write to the signals. */
  private requestId = 0;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly searchInput$ = new Subject<string>();

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => {
        this.query.set(value);
        this.page.set(1);
        this.load();
      });

    this.destroyRef.onDestroy(() => this.clearAutoClose());
  }

  ngOnInit(): void {
    this.load();
  }

  // ---------- toolbar ----------
  onSearchInput(value: string): void {
    this.searchInput$.next(String(value || '').trim());
  }

  onLimit(value: string): void {
    const n = Math.min(100, Math.max(10, Number(value) || DEFAULT_LIMIT));
    this.limit.set(n);
    this.page.set(1);
    this.load();
  }

  onSort(key: TGalaOrderSortKey): void {
    if (this.sortBy() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(key);
      // Times and "how many left" read best largest/newest first.
      this.sortDir.set(key === 'paidAt' || key === 'remaining' ? 'desc' : 'asc');
    }
    this.page.set(1);
    this.load();
  }

  sortIcon(key: TGalaOrderSortKey): string {
    if (this.sortBy() !== key) return '';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  refresh(): void {
    this.load();
  }

  prevPage(): void {
    if (this.page() <= 1 || this.loading()) return;
    this.page.set(this.page() - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.lastPage() || this.loading()) return;
    this.page.set(this.page() + 1);
    this.load();
  }

  // ---------- rows ----------
  toggleExpand(row: TGalaOrdersListItem): void {
    if (this.expandedId() === row.galaOrderMongoId) {
      this.expandedId.set(null);
      return;
    }

    this.expandedId.set(row.galaOrderMongoId);
    if (!this.ticketMap().has(row.galaOrderMongoId)) this.loadTickets(row.galaOrderMongoId);
  }

  isExpanded(row: TGalaOrdersListItem): boolean {
    return this.expandedId() === row.galaOrderMongoId;
  }

  isFullyRedeemed(row: TGalaOrdersListItem): boolean {
    return row.ticketCount > 0 && row.remaining <= 0;
  }

  ticketsFor(orderId: string): TGalaTicketRow[] | undefined {
    return this.ticketMap().get(orderId);
  }

  private loadTickets(orderMongoId: string): void {
    this.ticketsBusyId.set(orderMongoId);
    this.ticketsErrorId.set(null);
    this.ticketsErrorMsg.set(null);

    this.api
      .getOrderTickets(orderMongoId)
      .pipe(
        finalize(() => this.ticketsBusyId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => this.cacheTickets(orderMongoId, res.tickets || []),
        error: (err) => {
          this.ticketsErrorId.set(orderMongoId);
          this.ticketsErrorMsg.set(this.extractError(err));
        },
      });
  }

  private cacheTickets(orderMongoId: string, tickets: TGalaTicketRow[]): void {
    const next = new Map(this.ticketMap());
    next.set(orderMongoId, tickets);
    this.ticketMap.set(next);
  }

  // ---------- redeem ----------
  openRedeemNext(row: TGalaOrdersListItem, event?: Event): void {
    event?.stopPropagation();
    if (this.isFullyRedeemed(row)) return;

    this.redeemError.set(null);
    this.redeemResult.set(null);
    this.redeemTarget.set({ kind: 'next', order: row });
  }

  openRedeemTicket(row: TGalaOrdersListItem, ticket: TGalaTicketRow, event?: Event): void {
    event?.stopPropagation();
    if (ticket.redeemStatus === 'REDEEMED' || ticket.status !== 'ACTIVE') return;

    this.redeemError.set(null);
    this.redeemResult.set(null);
    this.redeemTarget.set({ kind: 'ticket', order: row, ticket });
  }

  closeRedeem(): void {
    // Block closing only while the request is in flight; once the result panel
    // is up the redemption is committed and closing must always work.
    if (this.redeemBusy() && !this.redeemResult()) return;

    this.clearAutoClose();
    this.redeemTarget.set(null);
    this.redeemResult.set(null);
    this.redeemError.set(null);
  }

  private scheduleAutoClose(): void {
    this.clearAutoClose();
    this.autoCloseTimer = setTimeout(() => {
      this.autoCloseTimer = null;
      this.closeRedeem();
    }, AUTO_CLOSE_MS);
  }

  private clearAutoClose(): void {
    if (this.autoCloseTimer === null) return;
    clearTimeout(this.autoCloseTimer);
    this.autoCloseTimer = null;
  }

  confirmRedeem(): void {
    const target = this.redeemTarget();
    if (!target || this.redeemBusy()) return;

    this.redeemBusy.set(true);
    this.redeemError.set(null);

    const request$ =
      target.kind === 'next'
        ? this.api.redeemNextForOrder(target.order.galaOrderMongoId)
        : this.api.redeemTicket(target.ticket.ticketId);

    request$
      .pipe(
        finalize(() => this.redeemBusy.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          const alreadyDone = Boolean(res?.alreadyRedeemed);
          const ticketId = res?.ticket?.ticketId || '';
          const at = res?.ticket?.redeemedAt || new Date().toISOString();
          const buyer = target.order.buyerName;

          this.applyRedeem(target.order.galaOrderMongoId, ticketId, res, alreadyDone);

          // Swap the dialog to a success panel rather than closing it silently —
          // the operator needs unmistakable confirmation.
          this.redeemResult.set({
            headline: buyer,
            primaryId: ticketId || target.order.orderId,
            title: alreadyDone ? 'Already redeemed' : 'Coupon redeemed',
            detail: alreadyDone
              ? `${ticketId} had already been redeemed.`
              : `One coupon redeemed for ${buyer}.`,
            alreadyDone,
            at,
          });

          this.infoMsg.set(
            alreadyDone
              ? `${ticketId} was already redeemed.`
              : `Coupon ${ticketId} redeemed for ${buyer}.`
          );
          this.errorMsg.set(null);
          this.scheduleAutoClose();
        },
        error: (err) => this.redeemError.set(this.extractError(err)),
      });
  }

  /**
   * Fold a redemption back into the table without a full reload: bump the
   * order's counters and mark the ticket in the expanded list.
   */
  private applyRedeem(
    orderMongoId: string,
    ticketId: string,
    res: { progress?: { redeemed: number; remaining: number }; ticket?: any },
    alreadyDone: boolean
  ): void {
    const redeemedAt = res?.ticket?.redeemedAt || new Date().toISOString();
    const byEmail =
      res?.ticket?.redeemedBy?.email || this.auth.currentUser?.email || null;

    this.rows.set(
      this.rows().map((o) => {
        if (o.galaOrderMongoId !== orderMongoId) return o;

        // Trust the server's counts when it sent them.
        if (res.progress) {
          return { ...o, redeemed: res.progress.redeemed, remaining: res.progress.remaining };
        }
        if (alreadyDone) return o;

        return {
          ...o,
          redeemed: o.redeemed + 1,
          remaining: Math.max(0, o.remaining - 1),
        };
      })
    );

    const cached = this.ticketMap().get(orderMongoId);
    if (cached && ticketId) {
      this.cacheTickets(
        orderMongoId,
        cached.map((t) =>
          t.ticketId === ticketId
            ? { ...t, redeemStatus: 'REDEEMED', redeemedAt, redeemedByEmail: byEmail }
            : t
        )
      );
    } else if (ticketId) {
      // "Redeem next" without the list open — drop the cache so the next
      // expand shows fresh state rather than a stale snapshot.
      const next = new Map(this.ticketMap());
      next.delete(orderMongoId);
      this.ticketMap.set(next);
    }

    if (!alreadyDone) {
      const s = this.summary();
      this.summary.set({
        orders: s.orders,
        tickets: s.tickets,
        redeemed: s.redeemed + 1,
        remaining: Math.max(0, s.remaining - 1),
      });
    }
  }

  // ---------- data ----------
  private currentQuery(): TGalaOrdersQuery {
    return {
      page: this.page(),
      limit: this.limit(),
      q: this.query(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
  }

  private load(): void {
    const requestId = ++this.requestId;

    this.loading.set(true);
    this.errorMsg.set(null);
    this.expandedId.set(null);

    this.api
      .listOrders(this.currentQuery())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (requestId !== this.requestId) return;
          this.loading.set(false);

          this.rows.set(res.items || []);
          this.total.set(res.total || 0);
          this.summary.set(res.summary || { orders: 0, tickets: 0, redeemed: 0, remaining: 0 });
          this.ticketMap.set(new Map());
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.loading.set(false);

          this.errorMsg.set(this.extractError(err));
          this.rows.set([]);
          this.total.set(0);
        },
      });
  }

  dismissInfo(): void {
    this.infoMsg.set(null);
  }

  trackByIndex(i: number): number {
    return i;
  }

  trackByOrderId(_: number, o: TGalaOrdersListItem): string {
    return o.galaOrderMongoId;
  }

  trackByTicketId(_: number, t: TGalaTicketRow): string {
    return t.ticketId;
  }

  private extractError(err: any): string {
    return String(
      err?.error?.message || err?.message || 'Something went wrong. Please try again.'
    );
  }
}
