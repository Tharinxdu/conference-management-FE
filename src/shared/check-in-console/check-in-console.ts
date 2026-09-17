// FILE: src/shared/check-in-console/check-in-console.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { PageShell } from '../../page-shell/page-shell';
import { QrScanner } from '../qr-scanner/qr-scanner';
import { CheckInService } from '../../services/check-in.service';
import { GalaRedeemService } from '../../services/gala-redeem.service';
import {
  MODE_META,
  type TCheckInMethod,
  type TCheckInMode,
  type TCheckInResult,
  type TRecentEntry,
  type TUnifiedPreview,
} from './check-in-console.types';

const MODE_STORAGE_KEY = 'apsc.checkin.mode';
const MAX_RECENT = 8;
/** How long the success panel stays up before the modal gets out of the way. */
const AUTO_CLOSE_MS = 2400;

/**
 * The check-in desk — used by both the admin and staff dashboards, so the two
 * roles see exactly the same screen.
 *
 * The operator picks which QR they are about to scan; the mode drives the API,
 * the copy and the accent colour, so it is obvious at a glance whether the app
 * expects a conference badge or a gala coupon. Both modes share the same
 * scan / manual-ID flow, confirmation dialog and success panel.
 */
@Component({
  selector: 'app-check-in-console',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, PageShell, QrScanner],
  templateUrl: './check-in-console.html',
  styleUrl: './check-in-console.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInConsole {
  private readonly checkInApi = inject(CheckInService);
  private readonly galaApi = inject(GalaRedeemService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(QrScanner) private scanner?: QrScanner;

  readonly modes: TCheckInMode[] = ['conference', 'gala'];
  readonly meta = MODE_META;

  readonly mode = signal<TCheckInMode>(this.readStoredMode());
  readonly method = signal<TCheckInMethod>('scan');

  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly preview = signal<TUnifiedPreview | null>(null);
  /** Set once a confirmation succeeds — the modal switches to a success panel. */
  readonly result = signal<TCheckInResult | null>(null);
  readonly recent = signal<TRecentEntry[]>([]);

  readonly manualForm = new FormGroup({
    code: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  });

  readonly activeMeta = computed(() => MODE_META[this.mode()]);

  readonly canConfirm = computed(() => {
    const p = this.preview();
    if (!p) return false;
    return !p.done && !p.blockedReason;
  });

  readonly confirmLabel = computed(() => {
    const p = this.preview();
    if (!p) return 'Confirm';
    if (p.blockedReason) return 'Cannot admit';
    if (p.done) return p.mode === 'gala' ? 'Already redeemed' : 'Already checked in';
    return p.mode === 'gala' ? 'Redeem coupon' : 'Confirm check-in';
  });

  /** Raw payload for the confirm call — never re-derived from the preview. */
  private lastQrText = '';
  private lastManualCode = '';
  /** Whether the camera was running when the current preview was raised. */
  private resumeScanner = false;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // The remembered mode decides how long a manual code has to be.
    this.applyManualValidators(this.mode());
    this.destroyRef.onDestroy(() => this.clearAutoClose());
  }

  private applyManualValidators(mode: TCheckInMode): void {
    this.manualForm.controls.code.setValidators([
      Validators.required,
      Validators.minLength(MODE_META[mode].manualMinLength),
    ]);
    this.manualForm.controls.code.updateValueAndValidity();
  }

  // ---------- mode / method ----------
  setMode(next: TCheckInMode): void {
    if (this.mode() === next) return;

    this.scanner?.stop();
    this.resetTransient();

    this.mode.set(next);
    this.applyManualValidators(next);
    this.manualForm.reset({ code: '' });

    this.writeStoredMode(next);
  }

  setMethod(next: TCheckInMethod): void {
    if (this.method() === next) return;

    if (next === 'manual') this.scanner?.stop();
    this.resetTransient();
    this.method.set(next);
  }

  // ---------- scanner ----------
  onScanned(text: string): void {
    const value = String(text || '').trim();
    if (!value) return;

    // The scanner stops itself on a hit; remember to bring it back afterwards.
    this.resumeScanner = true;
    this.lastQrText = value;
    this.previewScan(value);
  }

  onScanError(message: string): void {
    this.errorMsg.set(message);
  }

  // ---------- preview ----------
  private previewScan(qrText: string): void {
    this.errorMsg.set(null);
    this.loading.set(true);

    const mode = this.mode();
    const request$: Observable<any> =
      mode === 'gala' ? this.galaApi.previewQr(qrText) : this.checkInApi.previewQr(qrText);

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (res: any) => {
        this.result.set(null);
        this.preview.set(
          mode === 'gala' ? this.mapGalaPreview(res, 'scan') : this.mapConferencePreview(res, 'scan')
        );
        this.modalOpen.set(true);
      },
      error: (err) => this.failScan(err),
    });
  }

  previewManual(): void {
    this.errorMsg.set(null);

    const code = (this.manualForm.controls.code.value || '').trim().toUpperCase();
    if (!code || this.manualForm.invalid) return;

    this.loading.set(true);
    this.lastManualCode = code;
    this.resumeScanner = false;

    const mode = this.mode();
    const request$: Observable<any> =
      mode === 'gala'
        ? this.galaApi.previewByTicketId(code)
        : this.checkInApi.previewByRegistrationId(code);

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (res: any) => {
        this.result.set(null);
        this.preview.set(
          mode === 'gala'
            ? this.mapGalaPreview(res, 'manual')
            : this.mapConferencePreview(res, 'manual')
        );
        this.modalOpen.set(true);
      },
      error: (err) => this.errorMsg.set(this.extractError(err)),
    });
  }

  /** A failed scan should not leave the operator staring at a dead camera. */
  private failScan(err: unknown): void {
    this.errorMsg.set(this.extractError(err));
    if (this.resumeScanner) void this.scanner?.start();
    this.resumeScanner = false;
  }

  // ---------- confirm ----------
  confirm(): void {
    const p = this.preview();
    if (!p || !this.canConfirm() || this.loading()) return;

    this.errorMsg.set(null);
    this.loading.set(true);

    const request$: Observable<any> =
      p.mode === 'gala'
        ? p.method === 'scan'
          ? this.galaApi.confirmQr(this.lastQrText)
          : this.galaApi.confirmByTicketId(this.lastManualCode)
        : p.method === 'scan'
          ? this.checkInApi.confirmQr(this.lastQrText)
          : this.checkInApi.confirmByRegistrationId(this.lastManualCode);

    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (res: any) => {
        const alreadyDone = Boolean(res?.alreadyRedeemed || res?.alreadyCheckedIn);
        const verb = MODE_META[p.mode].successVerb;

        // Swap the dialog to a success panel rather than closing it silently —
        // the operator needs unmistakable confirmation before the next person.
        this.preview.set(null);
        this.result.set({
          mode: p.mode,
          headline: p.headline,
          primaryId: p.primaryId,
          alreadyDone,
          title: alreadyDone ? `Already ${verb}` : `${this.titleCase(verb)}`,
          detail: alreadyDone
            ? `${p.headline} was already ${verb}.`
            : `${p.headline} is ${verb}.`,
          at: res?.checkedInAt || res?.ticket?.redeemedAt || new Date().toISOString(),
        });

        this.pushRecent({
          mode: p.mode,
          label: p.headline,
          primaryId: p.primaryId,
          at: new Date().toISOString(),
          alreadyDone,
        });

        this.manualForm.reset({ code: '' });
        this.scheduleAutoClose();
      },
      error: (err) => this.errorMsg.set(this.extractError(err)),
    });
  }

  // ---------- modal ----------
  /** Close the dialog and hand the desk back to the scanner. */
  closeModal(): void {
    // Block closing only while a request is still in flight. Once a result is
    // on screen the action is already committed, so closing must always work —
    // otherwise a stray in-flight flag could strand the dialog open.
    if (this.loading() && !this.result()) return;

    this.clearAutoClose();
    this.modalOpen.set(false);
    this.preview.set(null);
    this.result.set(null);

    // Straight back to scanning for the next person in the queue.
    if (this.resumeScanner && this.method() === 'scan') void this.scanner?.start();
    this.resumeScanner = false;
  }

  private scheduleAutoClose(): void {
    this.clearAutoClose();
    this.autoCloseTimer = setTimeout(() => {
      this.autoCloseTimer = null;
      this.closeModal();
    }, AUTO_CLOSE_MS);
  }

  private clearAutoClose(): void {
    if (this.autoCloseTimer === null) return;
    clearTimeout(this.autoCloseTimer);
    this.autoCloseTimer = null;
  }

  clearAll(): void {
    this.resetTransient();
    this.manualForm.reset({ code: '' });
    this.recent.set([]);
  }

  // ---------- mapping ----------
  private mapConferencePreview(res: any, method: TCheckInMethod): TUnifiedPreview {
    const a = res?.attendee || {};
    const qr = res?.qr || {};

    const checkInStatus = qr.checkInStatus ?? res?.checkInStatus;
    const checkedInAt = qr.checkedInAt ?? res?.checkedInAt ?? null;
    const paymentStatus = res?.paymentStatus;

    const name = [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || 'Delegate';

    return {
      mode: 'conference',
      method,
      headline: name,
      primaryId: a.registrationId || res?.registrationId || '—',
      fields: [
        {
          label: 'Registration ID',
          value: a.registrationId || res?.registrationId || '—',
          mono: true,
        },
        { label: 'Conference', value: a.conferenceType || '—' },
        { label: 'Institution', value: a.institution || '—' },
        { label: 'Email', value: a.email || '—', mono: true },
      ],
      done: checkInStatus === 'CHECKED_IN',
      doneAt: checkedInAt,
      doneByEmail: qr.checkedInByEmail || null,
      blockedReason:
        paymentStatus && paymentStatus !== 'PAID' ? `Payment status is ${paymentStatus}` : null,
    };
  }

  private mapGalaPreview(res: any, method: TCheckInMethod): TUnifiedPreview {
    const t = res?.ticket || {};
    const order = t.order || {};

    return {
      mode: 'gala',
      method,
      headline: order.name || 'Gala guest',
      primaryId: t.ticketId || '—',
      fields: [
        { label: 'Ticket ID', value: t.ticketId || '—', mono: true },
        { label: 'Order ID', value: order.orderId || '—', mono: true },
        { label: 'Buyer email', value: order.email || '—', mono: true },
        { label: 'Tickets in order', value: String(order.ticketCount ?? '—') },
      ],
      done: t.redeemStatus === 'REDEEMED',
      doneAt: t.redeemedAt || null,
      doneByEmail: t.redeemedBy?.email || null,
      blockedReason:
        order.paymentStatus && order.paymentStatus !== 'PAID'
          ? `Order payment status is ${order.paymentStatus}`
          : t.status && t.status !== 'ACTIVE'
            ? `Ticket is ${t.status}`
            : null,
    };
  }

  // ---------- recent ----------
  private pushRecent(entry: TRecentEntry): void {
    this.recent.set([entry, ...this.recent()].slice(0, MAX_RECENT));
  }

  // ---------- misc ----------
  private resetTransient(): void {
    this.clearAutoClose();
    this.errorMsg.set(null);
    this.modalOpen.set(false);
    this.preview.set(null);
    this.result.set(null);
    this.lastQrText = '';
    this.lastManualCode = '';
    this.resumeScanner = false;
  }

  private titleCase(v: string): string {
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  private readStoredMode(): TCheckInMode {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'conference' || stored === 'gala') return stored;
    } catch {
      /* storage can be unavailable (private mode, blocked cookies) */
    }
    return 'conference';
  }

  private writeStoredMode(mode: TCheckInMode): void {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* remembering the mode is a convenience, never a requirement */
    }
  }

  trackByIndex(i: number): number {
    return i;
  }

  private extractError(err: any): string {
    return String(
      err?.error?.message || err?.message || 'Something went wrong. Please try again.'
    );
  }
}
