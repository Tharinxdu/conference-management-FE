// FILE: src/services/staff-gala-dashboard.service.ts
//
// Staff dashboard data. Staff now work both doors, so this covers conference
// check-in as well as gala redemption despite the historical file name.
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export type TStaffActivityType = 'CHECK_IN' | 'REDEEM';

export type TStaffActivityEntry = {
  type: TStaffActivityType;
  at: string;
  /** Delegate name, or the gala buyer's name. */
  label: string;
  /** Registration ID, or ticket ID. */
  primaryId: string;
  /** Conference type, or the order ID. */
  secondary: string | null;
  byEmail: string | null;
};

export type TStaffDashboardStats = {
  registrations: {
    total: number;
    checkedIn: number;
    notCheckedIn: number;
  };

  tickets: {
    totalPaidIssued: number;
    redeemed: number;
    remaining: number;
  };

  orders: {
    paidOrders: number;
    notRedeemedOrders: number;
    partiallyRedeemedOrders: number;
    fullyRedeemedOrders: number;
  };

  recentActivity: TStaffActivityEntry[];
  updatedAt: string;
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

@Injectable({ providedIn: 'root' })
export class StaffGalaDashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // Matches the Express mount: app.use("/api/staff/dashboard", staffDashboardRoutes)
  private readonly base = `${this.apiUrl}/staff/dashboard`;

  /** Combined conference + gala stats with a merged activity feed. */
  getStats(): Observable<TStaffDashboardStats> {
    return this.http.get<TStaffDashboardStats>(`${this.base}/stats`, {
      withCredentials: true,
    });
  }

  /** Paginated log of redeemed coupons. */
  getRedeemedTickets(params?: { page?: number; limit?: number }): Observable<TRedeemedTicketsPage> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));

    return this.http.get<TRedeemedTicketsPage>(`${this.base}/gala/redeemed`, {
      params: httpParams,
      withCredentials: true,
    });
  }
}
