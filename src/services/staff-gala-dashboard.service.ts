import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

export type TGalaStaffStats = {
  range?: { from: string | null; to: string | null };

  tickets: {
    totalPaidIssued: number;
    redeemed: number;
    remaining: number;
  };

  orders: {
    paidOrders: number;
    partiallyRedeemedOrders: number;
    fullyRedeemedOrders: number;
    notRedeemedOrders: number;
  };

  recentRedemptions: Array<{
    ticketId: string;
    orderId: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    redeemedAt: string | null; // ISO
    redeemedByEmail?: string | null;
  }>;
};

export type TRedeemedTicketsPage = {
  page: number;
  limit: number;
  total: number;
  items: Array<{
    ticketId: string;
    redeemedAt: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    orderId: string | null;
    redeemedByEmail: string | null;
  }>;
};

export type TPaidOrdersPage = {
  page: number;
  limit: number;
  total: number;
  items: Array<{
    orderId: string;
    buyerName: string;
    buyerEmail: string;
    ticketCount: number;
    redeemed: number;
    remaining: number;
    totalAmount: number;
    currency: string;
    paidAt: string | null;
  }>;
};

@Injectable({ providedIn: 'root' })
export class StaffGalaDashboardService {
  private readonly apiUrl = environment.apiUrl;

  // ✅ Matches your Express mount: app.use("/api/staff/dashboard", staffDashboardRoutes);
  private readonly base = `${this.apiUrl}/staff/dashboard`;

  constructor(private readonly http: HttpClient) {}

  /** Staff dashboard stats */
  getStats(params?: { from?: string; to?: string }) {
    return this.http.get<TGalaStaffStats>(`${this.base}/gala/stats`, {
      withCredentials: true,
      params: params as any,
    });
  }

  /** Optional: paginated list of redeemed tickets */
  getRedeemedTickets(params?: { page?: number; limit?: number }) {
    return this.http.get<TRedeemedTicketsPage>(`${this.base}/gala/redeemed`, {
      withCredentials: true,
      params: params as any,
    });
  }

  /** Optional: paginated list of PAID orders with redeem progress + search */
  getOrders(params?: { page?: number; limit?: number; q?: string }) {
    return this.http.get<TPaidOrdersPage>(`${this.base}/gala/orders`, {
      withCredentials: true,
      params: params as any,
    });
  }

  /** Logout (cookie clear) */
  logout() {
    return this.http.post<{ ok: true }>(
      `${this.apiUrl}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }
}