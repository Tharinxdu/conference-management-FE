import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EMPTY } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { PageShell } from '../page-shell/page-shell';
import { environment } from '../environments/environment';

type CreateGalaOrderResponse = {
  _id: string;
  orderId: string;
  name: string;
  email: string;
  ticketCount: number;
  totalAmount: number;
  currency: string;
  paymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';
};

@Component({
  selector: 'app-gala-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, PageShell, MatSnackBarModule],
  templateUrl: './gala-tickets.html',
  styleUrl: './gala-tickets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalaTickets {
  private readonly apiUrl = environment.apiUrl;

  // Form state
  name = '';
  email = '';
  ticketCount: number | null = 1;

  // UI state
  submitting = false;
  cardHidden = false;
  successVisible = false;
  successDetails = '';
  formStatus = '';

  // Errors + scroll support
  errorMessages: Record<string, string> = {};
  private validationErrorOrder: string[] = [];

  // Summary
  readonly unitPrice = 40;
  summaryText = 'Each ticket costs USD 40.';

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly snack: MatSnackBar
  ) {
    this.updateSummary();
  }

  private toastSuccess(message: string): void {
    this.snack.open(message, 'OK', { duration: 6500, panelClass: ['snack-success'] });
  }

  private toastError(message: string): void {
    this.snack.open(message, 'Dismiss', { duration: 9500, panelClass: ['snack-error'] });
  }

  onTicketCountChange(): void {
    this.updateSummary();
  }

  private updateSummary(): void {
    const n = Number(this.ticketCount || 0);
    if (!Number.isFinite(n) || n < 1) {
      this.summaryText = `Each ticket costs USD ${this.unitPrice}.`;
      this.cdr.markForCheck();
      return;
    }
    const total = n * this.unitPrice;
    this.summaryText = `Tickets: ${n}  •  Total: USD ${total}`;
    this.cdr.markForCheck();
  }

  private setError(name: string, message: string | null): void {
    const msg = message || '';
    if (msg && !this.validationErrorOrder.includes(name)) {
      this.validationErrorOrder.push(name);
    }
    this.errorMessages = { ...this.errorMessages, [name]: msg };
  }

  private clearAllErrors(): void {
    this.errorMessages = {};
    this.validationErrorOrder = [];
  }

  private scrollToFirstError(): void {
    if (!this.validationErrorOrder.length) return;
    setTimeout(() => this.scrollToField(this.validationErrorOrder[0]), 0);
  }

  private scrollToField(field: string): void {
    const form = document.getElementById('galaForm');
    if (!form) return;

    let anchor = form.querySelector(`[data-error-for="${CSS.escape(field)}"]`) as HTMLElement | null;
    const focusEl =
      (document.getElementById(field) as HTMLElement | null) ||
      (form.querySelector(`[name="${CSS.escape(field)}"]`) as HTMLElement | null);

    if (anchor) anchor = (anchor.closest('.form-group, .form-section') as HTMLElement | null) || anchor;

    const target = anchor || focusEl;
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    requestAnimationFrame(() => {
      const elToFocus = focusEl || (target.querySelector('input,select,textarea,button') as HTMLElement | null);
      if (!elToFocus) return;
      try {
        (elToFocus as any).focus({ preventScroll: true });
      } catch {
        elToFocus.focus();
      }
    });
  }

  private validateForm(): boolean {
    this.clearAllErrors();
    let valid = true;

    const name = (this.name || '').trim();
    const email = (this.email || '').trim();
    const count = Number(this.ticketCount);

    if (!name) {
      this.setError('name', 'This field is required.');
      valid = false;
    }

    if (!email) {
      this.setError('email', 'This field is required.');
      valid = false;
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.setError('email', 'Please enter a valid email address.');
      valid = false;
    }

    if (!Number.isInteger(count) || count < 1) {
      this.setError('ticketCount', 'Ticket count must be a whole number (minimum 1).');
      valid = false;
    } else if (count > 50) {
      this.setError('ticketCount', 'Maximum allowed is 50 tickets.');
      valid = false;
    }

    return valid;
  }

  onSubmit(): void {
    if (this.submitting) return;

    this.formStatus = '';

    if (!this.validateForm()) {
      this.formStatus = 'Please fix the highlighted errors.';
      this.toastError('Please fix the highlighted errors.');
      this.cdr.markForCheck();
      this.scrollToFirstError();
      return;
    }

    const payload = {
      name: this.name.trim(),
      email: this.email.trim(),
      ticketCount: Number(this.ticketCount),
    };

    this.submitting = true;
    this.formStatus = 'Creating ticket order...';
    this.toastSuccess('Creating ticket order…');
    this.cdr.markForCheck();

    // 1) Create gala order
    this.http
      .post<CreateGalaOrderResponse>(`${this.apiUrl}/gala`, payload)
      .pipe(
        catchError((err) => {
          const msg = err?.error?.message || err?.message || 'Failed to create ticket order.';
          this.formStatus = msg;
          this.toastError(msg);
          this.submitting = false;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe((order) => {
        if (!order?._id) {
          const msg = 'Order created but missing order id. Please contact support.';
          this.formStatus = msg;
          this.toastError(msg);
          this.submitting = false;
          this.cdr.markForCheck();
          return;
        }

        // 2) Initiate OnePay payment
        this.formStatus = 'Redirecting to payment...';
        this.toastSuccess('Redirecting to payment…');
        this.cdr.markForCheck();

        this.http
          .post<any>(`${this.apiUrl}/gala/onepay/initiate`, { galaOrderMongoId: order._id })
          .pipe(
            catchError((err) => {
              const msg = err?.error?.message || err?.message || 'Payment initiation failed.';
              this.formStatus = msg;
              this.toastError(msg);
              this.submitting = false;
              this.cdr.markForCheck();
              return EMPTY;
            }),
            finalize(() => {
              // If redirect succeeds, it won't matter. If it fails, UI re-enables.
              this.submitting = false;
              this.cdr.markForCheck();
            })
          )
          .subscribe((payRes) => {
            const redirectUrl = payRes?.redirectUrl;
            if (!redirectUrl) {
              const msg = 'Payment initiation succeeded but no redirect URL returned.';
              this.formStatus = msg;
              this.toastError(msg);
              this.cdr.markForCheck();
              return;
            }

            window.location.assign(redirectUrl);
          });
      });
  }
}