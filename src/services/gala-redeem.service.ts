import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../environments/environment";
import { Observable } from "rxjs";
import { GalaPreview, GalaConfirm } from "../staff/gala-check-in/gala-check-in.types";

@Injectable({ providedIn: "root" })
export class GalaRedeemService {
  private readonly baseUrl = `${environment.apiUrl}/gala-redeem`;

  constructor(private readonly http: HttpClient) {}

  previewQr(qrText: string): Observable<GalaPreview> {
    return this.http.post<GalaPreview>(
      `${this.baseUrl}/scan/preview`,
      { qrText },
      { withCredentials: true }
    );
  }

  confirmQr(qrText: string): Observable<GalaConfirm> {
    return this.http.post<GalaConfirm>(
      `${this.baseUrl}/scan/confirm`,
      { qrText },
      { withCredentials: true }
    );
  }

  previewByTicketId(ticketId: string): Observable<GalaPreview> {
    return this.http.post<GalaPreview>(
      `${this.baseUrl}/by-ticket-id/preview`,
      { ticketId },
      { withCredentials: true }
    );
  }

  confirmByTicketId(ticketId: string): Observable<GalaConfirm> {
    return this.http.post<GalaConfirm>(
      `${this.baseUrl}/by-ticket-id/confirm`,
      { ticketId },
      { withCredentials: true }
    );
  }
}