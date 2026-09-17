// FILE: src/shared/registrations-directory/registrations-directory.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageShell } from '../../page-shell/page-shell';
import { AuthService } from '../../services/auth.service';
import { CheckInService } from '../../services/check-in.service';
import { RegistrationsDirectoryService } from '../../services/registrations-directory.service';
import type {
  TCheckInOutcome,
  TCheckInStatus,
  TDirectoryScope,
  TRegistrationRow,
  TRegistrationSortKey,
  TRegistrationsQuery,
  TRegistrationsSummary,
  TSortDir,
} from './registrations-directory.types';

const SEARCH_DEBOUNCE_MS = 280;
const DEFAULT_LIMIT = 25;
/** How long the success panel stays up before the modal gets out of the way. */
const AUTO_CLOSE_MS = 2400;

/**
 * Directory of registrations that are ready for the desk: PAID *and* QR issued.
 *
 * Shared by the admin and staff dashboards. `scope` picks the API base and
 * decides whether the Excel export is offered (admin only) — everything else,
 * including manual check-in, is identical for both roles so the two dashboards
 * can never disagree about who is allowed in.
 */
@Component({
  selector: 'app-registrations-directory',
  standalone: true,
  imports: [CommonModule, PageShell],
  templateUrl: './registrations-directory.html',
  styleUrl: './registrations-directory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationsDirectory implements OnInit {
  private readonly api = inject(RegistrationsDirectoryService);
  private readonly checkInApi = inject(CheckInService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Which dashboard is hosting this view. */
  readonly scope = input.required<TDirectoryScope>();

  /** Excel export is an admin capability. */
  readonly canExport = computed(() => this.scope() === 'admin');

  // ----- query state -----
  readonly page = signal(1);
  readonly limit = signal(DEFAULT_LIMIT);
  readonly query = signal('');
  readonly conferenceType = signal('');
  readonly checkInFilter = signal<TCheckInStatus | ''>('');
  readonly sortBy = signal<TRegistrationSortKey>('name');
  readonly sortDir = signal<TSortDir>('asc');

  // ----- result state -----
  readonly rows = signal<TRegistrationRow[]>([]);
  readonly total = signal(0);
  readonly summary = signal<TRegistrationsSummary>({ total: 0, checkedIn: 0, notCheckedIn: 0 });
  readonly conferenceTypes = signal<string[]>([]);

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly infoMsg = signal<string | null>(null);

  // ----- row interaction state -----
  readonly expandedId = signal<string | null>(null);
  readonly checkInTarget = signal<TRegistrationRow | null>(null);
  readonly checkInBusy = signal(false);
  readonly checkInError = signal<string | null>(null);
  /** Set once a check-in succeeds — the modal switches to a success panel. */
  readonly checkInResult = signal<TCheckInOutcome | null>(null);

  readonly hasRows = computed(() => this.rows().length > 0);
  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly rangeStart = computed(() => (this.total() ? (this.page() - 1) * this.limit() + 1 : 0));
  readonly rangeEnd = computed(() => Math.min(this.page() * this.limit(), this.total()));

  readonly checkedInPct = computed(() => {
    const s = this.summary();
    if (!s.total) return 0;
    return Math.round((s.checkedIn / s.total) * 100);
  });

  /** Stale-response guard: only the newest request may write to the signals. */
  private requestId = 0;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly searchInput$ = new Subject<string>();

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => {
        this.query.set(value);
        this.page.set(1);
        this.load();
      });

    this.destroyRef.onDestroy(() => this.clearAutoClose());
  }

  ngOnInit(): void {
    this.load();
  }

  // ---------- toolbar ----------
  onSearchInput(value: string): void {
    this.searchInput$.next(String(value || '').trim());
  }

  onConferenceType(value: string): void {
    this.conferenceType.set(String(value || '').trim());
    this.page.set(1);
    this.load();
  }

  onCheckInFilter(value: string): void {
    const v = String(value || '').trim().toUpperCase();
    this.checkInFilter.set(v === 'CHECKED_IN' || v === 'NOT_CHECKED_IN' ? v : '');
    this.page.set(1);
    this.load();
  }

  onLimit(value: string): void {
    const n = Math.min(100, Math.max(10, Number(value) || DEFAULT_LIMIT));
    this.limit.set(n);
    this.page.set(1);
    this.load();
  }

  /** Click a sortable header: same key flips direction, new key starts ascending. */
  onSort(key: TRegistrationSortKey): void {
    if (this.sortBy() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(key);
      // Times read best newest-first; names and IDs read best A→Z.
      this.sortDir.set(key === 'checkedInAt' || key === 'registeredAt' ? 'desc' : 'asc');
    }
    this.page.set(1);
    this.load();
  }

  sortIcon(key: TRegistrationSortKey): string {
    if (this.sortBy() !== key) return '';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  refresh(): void {
    this.load();
  }

  prevPage(): void {
    if (this.page() <= 1 || this.loading()) return;
    this.page.set(this.page() - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.lastPage() || this.loading()) return;
    this.page.set(this.page() + 1);
    this.load();
  }

  // ---------- rows ----------
  toggleExpand(row: TRegistrationRow): void {
    this.expandedId.set(this.expandedId() === row.id ? null : row.id);
  }

  isExpanded(row: TRegistrationRow): boolean {
    return this.expandedId() === row.id;
  }

  isCheckedIn(row: TRegistrationRow): boolean {
    return row.qr?.checkInStatus === 'CHECKED_IN';
  }

  fullName(row: TRegistrationRow): string {
    return [row.title, row.firstName, row.lastName].filter(Boolean).join(' ').trim() || '—';
  }

  // ---------- manual check-in ----------
  openCheckIn(row: TRegistrationRow, event?: Event): void {
    event?.stopPropagation();
    if (this.isCheckedIn(row)) return;

    this.checkInError.set(null);
    this.checkInResult.set(null);
    this.checkInTarget.set(row);
  }

  closeCheckIn(): void {
    // Block closing only while the request is in flight; once the result panel
    // is up the check-in is committed and closing must always work.
    if (this.checkInBusy() && !this.checkInResult()) return;

    this.clearAutoClose();
    this.checkInTarget.set(null);
    this.checkInResult.set(null);
    this.checkInError.set(null);
  }

  private scheduleAutoClose(): void {
    this.clearAutoClose();
    this.autoCloseTimer = setTimeout(() => {
      this.autoCloseTimer = null;
      this.closeCheckIn();
    }, AUTO_CLOSE_MS);
  }

  private clearAutoClose(): void {
    if (this.autoCloseTimer === null) return;
    clearTimeout(this.autoCloseTimer);
    this.autoCloseTimer = null;
  }

  confirmCheckIn(): void {
    const row = this.checkInTarget();
    if (!row || this.checkInBusy()) return;

    this.checkInBusy.set(true);
    this.checkInError.set(null);

    this.checkInApi
      .confirmByRegistrationId(row.registrationId)
      .pipe(
        finalize(() => this.checkInBusy.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res: any) => {
          const wasAlready = Boolean(res?.alreadyCheckedIn);
          const at = res?.checkedInAt || new Date().toISOString();
          const name = this.fullName(row);

          this.patchRow(row.id, {
            checkInStatus: 'CHECKED_IN',
            checkedInAt: at,
            checkedInByEmail: res?.checkedInByEmail || this.auth.currentUser?.email || null,
          });

          if (!wasAlready) this.bumpCheckedInCount();

          // Swap the dialog to a success panel rather than closing it silently —
          // the operator needs unmistakable confirmation.
          this.checkInResult.set({
            headline: name,
            primaryId: row.registrationId,
            title: wasAlready ? 'Already checked in' : 'Checked in',
            detail: wasAlready
              ? `${name} was already checked in.`
              : `${name} is checked in.`,
            alreadyDone: wasAlready,
            at,
          });

          this.infoMsg.set(
            wasAlready ? `${name} was already checked in.` : `${name} checked in.`
          );
          this.errorMsg.set(null);
          this.scheduleAutoClose();
        },
        error: (err) => this.checkInError.set(this.extractError(err)),
      });
  }

  /** Replace one row's QR block without re-fetching the whole page. */
  private patchRow(rowId: string, qrPatch: Partial<TRegistrationRow['qr']>): void {
    this.rows.set(
      this.rows().map((r) => (r.id === rowId ? { ...r, qr: { ...r.qr, ...qrPatch } } : r))
    );

    // Drop the row if it no longer matches an active "not checked in" filter.
    if (this.checkInFilter() === 'NOT_CHECKED_IN' && qrPatch.checkInStatus === 'CHECKED_IN') {
      this.rows.set(this.rows().filter((r) => r.id !== rowId));
      this.total.set(Math.max(0, this.total() - 1));
    }
  }

  private bumpCheckedInCount(): void {
    const s = this.summary();
    this.summary.set({
      total: s.total,
      checkedIn: s.checkedIn + 1,
      notCheckedIn: Math.max(0, s.notCheckedIn - 1),
    });
  }

  // ---------- export ----------
  exportExcel(): void {
    if (!this.canExport() || this.exporting()) return;

    this.exporting.set(true);
    this.errorMsg.set(null);

    this.api
      .exportExcel(this.currentQuery(false))
      .pipe(
        finalize(() => this.exporting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, `registrations-${new Date().toISOString().slice(0, 10)}.xlsx`);
          this.infoMsg.set('Export downloaded.');
        },
        error: (err) => this.errorMsg.set(this.extractError(err)),
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- data ----------
  private currentQuery(includePaging = true): TRegistrationsQuery {
    const q: TRegistrationsQuery = {
      q: this.query(),
      conferenceType: this.conferenceType(),
      checkInStatus: this.checkInFilter(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };

    if (includePaging) {
      q.page = this.page();
      q.limit = this.limit();
    }

    return q;
  }

  private load(): void {
    const requestId = ++this.requestId;

    this.loading.set(true);
    this.errorMsg.set(null);
    this.expandedId.set(null);

    this.api
      .list(this.scope(), this.currentQuery())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (requestId !== this.requestId) return; // a newer request already won
          this.loading.set(false);

          this.rows.set(res.items || []);
          this.total.set(res.total || 0);
          this.summary.set(res.summary || { total: 0, checkedIn: 0, notCheckedIn: 0 });
          this.conferenceTypes.set(res.conferenceTypes || []);
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.loading.set(false);

          this.errorMsg.set(this.extractError(err));
          this.rows.set([]);
          this.total.set(0);
        },
      });
  }

  dismissInfo(): void {
    this.infoMsg.set(null);
  }

  trackByIndex(i: number): number {
    return i;
  }

  trackByRowId(_: number, row: TRegistrationRow): string {
    return row.id;
  }

  private extractError(err: any): string {
    return String(
      err?.error?.message || err?.message || 'Something went wrong. Please try again.'
    );
  }
}
