import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EMPTY, Subscription, timer } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { PageShell } from '../../page-shell/page-shell';

type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';

type StatusResponse = {
  paymentStatus: PaymentStatus;
  onepayTransactionId?: string;
  redirectUrl?: string;
  paidAt?: string | Date;
  lastError?: string;
  registration?: {
    registrationId: string;
    title?: string;
    firstName?: string;
    lastName?: string;
    designation?: string;
    institution?: string;
    country?: string;
    participantCategory?: string;
    conferenceType?: string;
    incomeGroup?: string;
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
export class RegistrationStatus implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;

  state: ViewState = 'loading';
  busy = false;

  // read from ?rid=
  rid: string | null = null;

  // response fields
  onepayTransactionId: string | null = null;
  paidAt: Date | null = null;
  lastError: string | null = null;
  registration: StatusResponse['registration'] | null = null;

  // UI errors (network etc.)
  errorText: string | null = null;

  private pollSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.rid = this.route.snapshot.queryParamMap.get('rid');

    if (!this.rid) {
      this.state = 'missing';
      this.cdr.markForCheck();
      return;
    }

    // Start polling: immediate + every 3 seconds until final
    this.state = 'loading';
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  refreshNow(): void {
    if (!this.rid) return;
    this.busy = true;
    this.errorText = null;
    this.cdr.markForCheck();

    this.fetchStatusOnce()
      .pipe(
        tap(() => {
          this.busy = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe();
  }

  private startPolling(): void {
    if (!this.rid) return;

    this.pollSub?.unsubscribe();

    this.pollSub = timer(0, 3000)
      .pipe(
        switchMap(() => this.fetchStatusOnce())
      )
      .subscribe();
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  private fetchStatusOnce() {
    if (!this.rid) return EMPTY;

    return this.http
      .get<StatusResponse>(`${this.apiUrl}/payments/onepay/status/${encodeURIComponent(this.rid)}`)
      .pipe(
        tap((res) => this.applyStatus(res)),
        catchError((err) => {
          // Keep polling but show a hint
          const msg =
            err?.error?.message ||
            err?.message ||
            'Failed to fetch payment status.';
          this.errorText = msg;
          this.cdr.markForCheck();
          return EMPTY;
        })
      );
  }

  private applyStatus(res: StatusResponse): void {
    this.onepayTransactionId = res.onepayTransactionId || null;
    this.lastError = res.lastError || null;
    this.registration = res.registration || null;

    this.paidAt = res.paidAt ? new Date(res.paidAt) : null;

    if (res.paymentStatus === 'PAID') {
      this.state = 'success';
      this.stopPolling();
      this.cdr.markForCheck();
      return;
    }

    if (res.paymentStatus === 'FAILED' || res.paymentStatus === 'CANCELED') {
      this.state = 'failed';
      this.stopPolling();
      this.cdr.markForCheck();
      return;
    }

    // UNPAID or PENDING
    this.state = 'pending';
    this.cdr.markForCheck();
  }

  goToRegistration(): void {
    // Change this route to match your app routing
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
