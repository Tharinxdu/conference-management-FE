import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

export type TGalaOrdersListItem = {
  galaOrderMongoId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  ticketCount: number;
  redeemed: number;
  remaining: number;
  paymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';
  totalAmount: number;
  currency: string;
  paidAt?: string | null;
  createdAt?: string | null;
};

export type TGalaOrdersListResponse = {
  page: number;
  limit: number;
  total: number;
  items: TGalaOrdersListItem[];
};

export type TGalaOrderTicketsResponse = {
  order: {
    galaOrderMongoId: string;
    orderId: string;
    name: string;
    email: string;
    ticketCount: number;
    totalAmount: number;
    currency: string;
    paymentStatus: string;
    paidAt?: string | null;
    createdAt?: string | null;
  };
  tickets: Array<{
    ticketId: string;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    redeemStatus: 'NOT_REDEEMED' | 'REDEEMED';
    redeemedAt?: string | null;
    redeemedByEmail?: string | null;
    expiresAt?: string | null;
  }>;
};

@Injectable({ providedIn: 'root' })
export class GalaOrdersService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listOrders(params: {
    page: number;
    limit: number;
    q?: string;
    paymentStatus?: string | null;
  }) {
    const q = params.q ? encodeURIComponent(params.q) : '';
    const paymentStatus = params.paymentStatus ? encodeURIComponent(params.paymentStatus) : '';

    const url =
      `${this.apiUrl}/staff/dashboard/gala/orders/list` +
      `?page=${params.page}&limit=${params.limit}` +
      (q ? `&q=${q}` : '') +
      (paymentStatus ? `&paymentStatus=${paymentStatus}` : '');

    return this.http.get<TGalaOrdersListResponse>(url, { withCredentials: true });
  }

  getOrderTickets(galaOrderMongoId: string) {
    const url = `${this.apiUrl}/staff/dashboard/gala/orders/${encodeURIComponent(
      galaOrderMongoId
    )}/tickets`;
    return this.http.get<TGalaOrderTicketsResponse>(url, { withCredentials: true });
  }
}