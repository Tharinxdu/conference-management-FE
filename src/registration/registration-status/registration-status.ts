import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EMPTY } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { PageShell } from '../../page-shell/page-shell';

type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';

type StatusResponse = {
  paymentStatus: PaymentStatus;
  onepayTransactionId?: string;
  redirectUrl?: string;
  paidAt?: string | Date;
  lastError?: string;

  // What was actually charged. For local registrants paying in rupees this is
  // LKR; registration.feeAmount is always the USD fee.
  currency?: 'USD' | 'LKR';
  amount?: number;

  registration?: {
    registrationId: string;
    title?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    participantCategory?: string;
    conferenceType?: string;
    feeAmount?: number;
    feePeriod?: string;
    email?: string;
    hasQr?: boolean;
  };
};

type ViewState = 'missing' | 'loading' | 'pending' | 'success' | 'failed';

@Component({
  selector: 'app-registration-status',
  standalone: true,
  imports: [CommonModule, HttpClientModule, PageShell],
  templateUrl: './registration-status.html',
  styleUrl: './registration-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationStatus implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  state: ViewState = 'loading';
  busy = false;

  rid: string | null = null;

  paidAt: Date | null = null;
  lastError: string | null = null;
  registration: StatusResponse['registration'] | null = null;

  // Charged currency and amount, straight from the payment record.
  paidCurrency: 'USD' | 'LKR' | null = null;
  paidAmount: number | null = null;

  errorText: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  /** True when the registrant paid in rupees, so we can also show the USD fee. */
  get paidInLkr(): boolean {
    return this.paidCurrency === 'LKR';
  }

  ngOnInit(): void {
    this.rid = this.route.snapshot.queryParamMap.get('rid');

    if (!this.rid) {
      this.state = 'missing';
      this.cdr.markForCheck();
      return;
    }

    // ✅ One request; backend may take up to 60s and then returns final status.
    this.checkStatus();
  }

  private checkStatus(): void {
    if (!this.rid || this.busy) return;

    this.busy = true;
    this.errorText = null;

    // Show the pending screen while the long request is running
    this.state = 'pending';
    this.cdr.markForCheck();

    this.http
      .get<StatusResponse>(`${this.apiUrl}/payments/onepay/status/${encodeURIComponent(this.rid)}`)
      .pipe(
        tap((res) => this.applyStatus(res)),
        catchError((err) => {
          const msg =
            err?.error?.message ||
            err?.message ||
            'Failed to check payment status. Please try again.';
          this.errorText = msg;

          // Keep pending UI but show error text
          this.state = 'pending';
          this.cdr.markForCheck();
          return EMPTY;
        }),
        finalize(() => {
          this.busy = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe();
  }

  private applyStatus(res: StatusResponse): void {
    this.lastError = res.lastError || null;
    this.registration = res.registration || null;
    this.paidAt = res.paidAt ? new Date(res.paidAt) : null;

    // Fall back to USD only if the backend didn't send a currency (older records).
    this.paidCurrency = res.currency || 'USD';
    this.paidAmount = res.amount ?? null;

    if (res.paymentStatus === 'PAID') {
      this.state = 'success';
      this.cdr.markForCheck();
      return;
    }

    if (res.paymentStatus === 'FAILED' || res.paymentStatus === 'CANCELED') {
      this.state = 'failed';
      this.cdr.markForCheck();
      return;
    }

    // If backend ever returns PENDING/UNPAID, keep pending screen
    this.state = 'pending';
    this.cdr.markForCheck();
  }

  goToRegistration(): void {
    this.router.navigateByUrl('/registration');
  }

  prettyConference(v?: string): string {
    if (v === 'full') return 'Full Conference Registration (26–28 Nov 2026)';
    if (v === 'rehab') return 'Rehabilitation Workshop (28 Nov 2026)';
    return v || 'N/A';
  }

  prettyCategory(v?: string): string {
    if (v === 'physician') return 'Physician';
    if (v === 'non-physician') return 'Non-physician';
    return v || 'N/A';
  }
}