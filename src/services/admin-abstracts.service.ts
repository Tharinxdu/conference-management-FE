// FILE: src/app/services/admin-abstracts.service.ts
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../src/environments/environment";
import {
  AdminAbstractDTO,
  AdminAbstractFilters,
  AdminAbstractListResponse,
  AdminAbstractStatus,
} from "../admin/admin-abstract/admin-abstract.types";

@Injectable({ providedIn: "root" })
export class AdminAbstractsService {
  private readonly apiUrl = environment.apiUrl; // includes /api
  private readonly adminAbstractsUrl = `${this.apiUrl}/admin/abstracts`;

  constructor(private readonly http: HttpClient) {}

  listAbstracts(
    filters: AdminAbstractFilters,
    page: number,
    limit: number
  ): Observable<AdminAbstractListResponse> {
    let params = new HttpParams()
      .set("page", String(page))
      .set("limit", String(limit));

    const search = (filters?.search || "").trim();
    const status = (filters?.status || "").trim();
    const ownerId = (filters?.ownerId || "").trim();

    if (search) params = params.set("search", search);
    if (status) params = params.set("status", status);
    if (ownerId) params = params.set("ownerId", ownerId);

    return this.http.get<AdminAbstractListResponse>(this.adminAbstractsUrl, {
      params,
      withCredentials: true,
    });
  }

  getMyAbstract(id: string): Observable<AdminAbstractDTO> {
    return this.http.get<AdminAbstractDTO>(
      `${this.adminAbstractsUrl}/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  saveAbstractAllInOne(
    id: string,
    updatesObj: any,
    removeAttachmentIds: any,
    files: File[] = []
  ): Observable<AdminAbstractDTO> {
    const fd = new FormData();
    fd.append("updates", JSON.stringify(updatesObj ?? {}));

    const raw = removeAttachmentIds as any;

    const isAll =
      raw === "ALL" ||
      (Array.isArray(raw) && raw.includes("ALL")) ||
      (typeof raw === "string" && raw.trim() === "ALL");

    if (isAll) {
      fd.append("removeAttachmentIds", "ALL");
    } else {
      let ids: string[] = [];
      if (Array.isArray(raw)) ids = raw.map(String).filter(Boolean);
      else if (typeof raw === "string") {
        const s = raw.trim();
        if (s) {
          if (s.startsWith("[") && s.endsWith("]")) {
            try {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) ids = parsed.map(String).filter(Boolean);
            } catch {
              ids = [s];
            }
          } else {
            ids = [s];
          }
        }
      }
      if (ids.length > 0) fd.append("removeAttachmentIds", JSON.stringify(ids));
    }

    for (const f of files || []) fd.append("files", f, f.name);

    return this.http.patch<AdminAbstractDTO>(
      `${this.adminAbstractsUrl}/${encodeURIComponent(id)}`,
      fd,
      { withCredentials: true }
    );
  }

  buildAttachmentUrl(storedName: string): string {
    if (!storedName) return "";
    const origin = this.apiUrl.replace(/\/api$/, "");
    return `${origin}/uploads/abstracts/${encodeURIComponent(storedName)}`;
  }

  updateStatus(id: string, status: AdminAbstractStatus): Observable<AdminAbstractDTO> {
    return this.http.put<AdminAbstractDTO>(
      `${this.adminAbstractsUrl}/${encodeURIComponent(id)}/status`,
      { status },
      { withCredentials: true }
    );
  }

  deleteAbstract(id: string): Observable<{ ok: boolean; message?: string }> {
    return this.http.delete<{ ok: boolean; message?: string }>(
      `${this.adminAbstractsUrl}/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  /**
   * ✅ Backend Excel export (ALL matching filters)
   * GET /api/admin/abstracts/export/excel?search=&status=&ownerId=
   */
  exportExcel(filters: AdminAbstractFilters): Observable<Blob> {
    let params = new HttpParams();

    const search = (filters?.search || "").trim();
    const status = (filters?.status || "").trim();
    const ownerId = (filters?.ownerId || "").trim();

    if (search) params = params.set("search", search);
    if (status) params = params.set("status", status);
    if (ownerId) params = params.set("ownerId", ownerId);

    return this.http.get(`${this.adminAbstractsUrl}/export/excel`, {
      params,
      responseType: "blob",
      withCredentials: true,
    });
  }
}
