// FILE: src/services/gala-orders.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export type TGalaOrderSortKey = 'buyerName' | 'orderId' | 'tickets' | 'remaining' | 'paidAt';
export type TSortDir = 'asc' | 'desc';

export type TGalaOrdersListItem = {
  galaOrderMongoId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  country?: string | null;
  ticketCount: number;
  redeemed: number;
  remaining: number;
  paymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';
  totalAmount: number;
  currency: string;
  paidAt?: string | null;
  createdAt?: string | null;
};

export type TGalaOrdersSummary = {
  orders: number;
  tickets: number;
  redeemed: number;
  remaining: number;
};

export type TGalaOrdersListResponse = {
  page: number;
  limit: number;
  total: number;
  sortBy: TGalaOrderSortKey;
  sortDir: TSortDir;
  items: TGalaOrdersListItem[];
  summary: TGalaOrdersSummary;
};

export type TGalaTicketRow = {
  ticketId: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  redeemStatus: 'NOT_REDEEMED' | 'REDEEMED';
  redeemedAt?: string | null;
  redeemedByEmail?: string | null;
  expiresAt?: string | null;
};

export type TGalaOrderTicketsResponse = {
  order: {
    galaOrderMongoId: string;
    orderId: string;
    name: string;
    email: string;
    country?: string | null;
    ticketCount: number;
    totalAmount: number;
    currency: string;
    paymentStatus: string;
    paidAt?: string | null;
    createdAt?: string | null;
  };
  tickets: TGalaTicketRow[];
};

export type TGalaOrdersQuery = {
  page?: number;
  limit?: number;
  q?: string;
  sortBy?: TGalaOrderSortKey;
  sortDir?: TSortDir;
};

export type TRedeemResponse = {
  ok: true;
  message: string;
  alreadyRedeemed?: boolean;
  ticket: { ticketId: string; redeemedAt?: string | null; redeemedBy?: { email: string | null } | null };
  progress?: { ticketCount: number; redeemed: number; remaining: number };
};

/**
 * PAID gala orders with redemption progress, plus the two redeem paths used
 * from the orders table: a specific ticket, or the next unclaimed coupon on an
 * order (picked atomically server-side).
 */
@Injectable({ providedIn: 'root' })
export class GalaOrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly ordersUrl = `${this.apiUrl}/staff/dashboard/gala/orders`;
  private readonly redeemUrl = `${this.apiUrl}/gala/redeem`;

  listOrders(query: TGalaOrdersQuery): Observable<TGalaOrdersListResponse> {
    let params = new HttpParams();

    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));

    const q = (query.q || '').trim();
    if (q) params = params.set('q', q);

    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortDir) params = params.set('sortDir', query.sortDir);

    return this.http.get<TGalaOrdersListResponse>(this.ordersUrl, {
      params,
      withCredentials: true,
    });
  }

  getOrderTickets(galaOrderMongoId: string): Observable<TGalaOrderTicketsResponse> {
    return this.http.get<TGalaOrderTicketsResponse>(
      `${this.ordersUrl}/${encodeURIComponent(galaOrderMongoId)}/tickets`,
      { withCredentials: true }
    );
  }

  /** Redeem one named coupon. */
  redeemTicket(ticketId: string): Observable<TRedeemResponse> {
    return this.http.post<TRedeemResponse>(
      `${this.redeemUrl}/by-ticket-id/confirm`,
      { ticketId },
      { withCredentials: true }
    );
  }

  /**
   * Redeem the next unclaimed coupon on an order. The server picks and marks it
   * in one atomic update, so two operators can't claim the same coupon.
   */
  redeemNextForOrder(galaOrderMongoId: string): Observable<TRedeemResponse> {
    return this.http.post<TRedeemResponse>(
      `${this.redeemUrl}/order/next`,
      { galaOrderMongoId },
      { withCredentials: true }
    );
  }
}
