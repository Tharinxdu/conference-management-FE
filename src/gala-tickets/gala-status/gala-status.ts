import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EMPTY } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { PageShell } from '../../page-shell/page-shell';

type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';

type GalaStatusResponse = {
  paymentStatus: PaymentStatus;
  redirectUrl?: string;
  paidAt?: string | Date;
  lastError?: string;

  // What was actually charged. For local buyers this is LKR;
  // order.totalAmount is always the USD ticket total.
  currency?: 'USD' | 'LKR';
  amount?: number;

  order?: {
    orderId: string;
    name: string;
    email: string;
    country?: string;
    ticketCount: number;
    totalAmount: number;
    currency: string;
    chargedAmount?: number;
  };
};

type ViewState = 'missing' | 'loading' | 'pending' | 'success' | 'failed';

@Component({
  selector: 'app-gala-status',
  standalone: true,
  imports: [CommonModule, HttpClientModule, PageShell],
  templateUrl: './gala-status.html',
  styleUrl: './gala-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalaStatus implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  state: ViewState = 'loading';
  busy = false;

  gid: string | null = null;
  paidAt: Date | null = null;
  lastError: string | null = null;
  order: GalaStatusResponse['order'] | null = null;

  // Charged currency and amount, straight from the order record.
  paidCurrency: 'USD' | 'LKR' | null = null;
  paidAmount: number | null = null;

  errorText: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  /** True when the buyer paid in rupees, so we can also show the USD total. */
  get paidInLkr(): boolean {
    return this.paidCurrency === 'LKR';
  }

  ngOnInit(): void {
    this.gid = this.route.snapshot.queryParamMap.get('gid');

    if (!this.gid) {
      this.state = 'missing';
      this.cdr.markForCheck();
      return;
    }

    this.checkStatus();
  }

  private checkStatus(): void {
    if (!this.gid || this.busy) return;

    this.busy = true;
    this.errorText = null;

    this.state = 'pending';
    this.cdr.markForCheck();

    this.http
      .get<GalaStatusResponse>(`${this.apiUrl}/gala/onepay/status/${encodeURIComponent(this.gid)}`)
      .pipe(
        tap((res) => this.applyStatus(res)),
        catchError((err) => {
          const msg = err?.error?.message || err?.message || 'Failed to check payment status. Please try again.';
          this.errorText = msg;
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

  private applyStatus(res: GalaStatusResponse): void {
    this.lastError = res.lastError || null;
    this.order = res.order || null;
    this.paidAt = res.paidAt ? new Date(res.paidAt) : null;

    // Fall back to USD only if the backend sent no currency (older records).
    this.paidCurrency = res.currency || 'USD';
    this.paidAmount = res.amount ?? null;

    if (res.paymentStatus === 'PAID') {
      this.state = 'success';
      this.cdr.markForCheck();
      return;
    }

    if (res.paymentStatus === 'FAILED') {
      this.state = 'failed';
      this.cdr.markForCheck();
      return;
    }

    this.state = 'pending';
    this.cdr.markForCheck();
  }

  goToGalaForm(): void {
    this.router.navigateByUrl('/gala-dinner');
  }
}