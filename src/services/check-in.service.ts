// FILE: src/admin/check-in/check-in.service.ts
import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../environments/environment";
import { Observable } from "rxjs";
import type {
  ConfirmByRegistrationIdResponse,
  ConfirmQrResponse,
  PreviewByRegistrationIdResponse,
  PreviewQrResponse,
} from "../admin/check-in/check-in.types";

@Injectable({ providedIn: "root" })
export class CheckInService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/checkin`;

  previewQr(qrText: string): Observable<PreviewQrResponse> {
    return this.http.post<PreviewQrResponse>(
      `${this.base}/scan/preview`,
      { qrText },
      { withCredentials: true }
    );
  }

  confirmQr(qrText: string): Observable<ConfirmQrResponse> {
    return this.http.post<ConfirmQrResponse>(
      `${this.base}/scan/confirm`,
      { qrText },
      { withCredentials: true }
    );
  }

  previewByRegistrationId(registrationId: string): Observable<PreviewByRegistrationIdResponse> {
    return this.http.post<PreviewByRegistrationIdResponse>(
      `${this.base}/by-registration-id/preview`,
      { registrationId },
      { withCredentials: true }
    );
  }

  confirmByRegistrationId(registrationId: string): Observable<ConfirmByRegistrationIdResponse> {
    return this.http.post<ConfirmByRegistrationIdResponse>(
      `${this.base}/by-registration-id/confirm`,
      { registrationId },
      { withCredentials: true }
    );
  }
}
