// FILE: src/admin/admin-dashboard/admin-dashboard.service.ts
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../src/environments/environment";

export type TAdminDashboardStats = {
  range: { from: string | null; to: string | null };

  registrations: {
    total: number;
    withQr: number;
    paymentStatus: {
      PAID: number;
      PENDING: number;
      UNPAID: number;
      FAILED: number;
    };
  };

  revenue: {
    paidTotal: number;
    pendingTotal: number;
  };

  qr: {
    total: number;
    status: {
      ACTIVE: number;
      REVOKED: number;
      EXPIRED: number;
    };
    checkin: {
      CHECKED_IN: number;
      NOT_CHECKED_IN: number;
    };
  };

  abstracts: {
    total: number;
    status: {
      submitted: number;
      "under-review": number;
      approved: number;
      rejected: number;
    };
  };
};

@Injectable({ providedIn: "root" })
export class AdminDashboardService {
  private readonly apiUrl = environment.apiUrl; // includes /api
  private readonly adminDashboardUrl = `${this.apiUrl}/admin/dashboard`;

  constructor(private readonly http: HttpClient) {}

  getStats(opts?: { from?: string; to?: string }): Observable<TAdminDashboardStats> {
    let params = new HttpParams();

    const from = (opts?.from || "").trim();
    const to = (opts?.to || "").trim();

    if (from) params = params.set("from", from);
    if (to) params = params.set("to", to);

    return this.http.get<TAdminDashboardStats>(this.adminDashboardUrl, {
      params,
      withCredentials: true,
    });
  }

  logout(): Observable<{ ok?: boolean; message?: string }> {
    return this.http.post<{ ok?: boolean; message?: string }>(
      `${this.apiUrl}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }
}
