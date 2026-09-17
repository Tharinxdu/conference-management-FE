// FILE: src/services/registrations-directory.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import type {
  TDirectoryScope,
  TRegistrationsListResponse,
  TRegistrationsQuery,
} from '../shared/registrations-directory/registrations-directory.types';

/**
 * Registrations that are ready for the desk: PAID *and* QR issued.
 *
 * Admin and staff hit different routes with identical contracts, so the scope
 * only decides the base URL. Excel export is admin-only on the server.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationsDirectoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private baseFor(scope: TDirectoryScope): string {
    return scope === 'admin'
      ? `${this.apiUrl}/admin/registrations`
      : `${this.apiUrl}/staff/dashboard/registrations`;
  }

  private toParams(query: TRegistrationsQuery): HttpParams {
    let params = new HttpParams();

    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));

    const q = (query.q || '').trim();
    if (q) params = params.set('q', q);

    const conferenceType = (query.conferenceType || '').trim();
    if (conferenceType) params = params.set('conferenceType', conferenceType);

    const checkInStatus = (query.checkInStatus || '').trim();
    if (checkInStatus) params = params.set('checkInStatus', checkInStatus);

    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortDir) params = params.set('sortDir', query.sortDir);

    return params;
  }

  list(scope: TDirectoryScope, query: TRegistrationsQuery): Observable<TRegistrationsListResponse> {
    return this.http.get<TRegistrationsListResponse>(this.baseFor(scope), {
      params: this.toParams(query),
      withCredentials: true,
    });
  }

  /**
   * Exports every row matching the current filters (not just the visible page).
   * Admin only — the staff route has no export endpoint.
   */
  exportExcel(query: TRegistrationsQuery): Observable<Blob> {
    const { page, limit, ...rest } = query;

    return this.http.get(`${this.baseFor('admin')}/export/excel`, {
      params: this.toParams(rest),
      responseType: 'blob',
      withCredentials: true,
    });
  }
}
