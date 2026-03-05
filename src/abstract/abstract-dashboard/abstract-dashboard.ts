// FILE: src/abstract/abstract-dashboard/abstract-dashboard.ts

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { AbstractFormModal } from '../abstract-form-modal/abstract-form-modal';
import { AbstractDTO, AbstractMode } from '../abstract-form-modal/abstract.types';
import { AbstractDashboardService } from '../../services/abstract-dashboard.service';
import { AuthService } from '../../services/auth.service';
import {
  PresentingAuthorProfileService,
  ProfileDTO,
  ProfileMeResponse,
} from '../../services/profile.service';

import { PageShell } from '../../page-shell/page-shell';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';

type ProfileMode = 'create' | 'edit';
type TitleEnum = 'Dr' | 'Prof' | 'Mr' | 'Ms' | 'Other';

type ProfileFormModel = {
  title: FormControl<TitleEnum>;
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  country: FormControl<string>;
  affiliation: FormControl<string>;
  department: FormControl<string>;
  city: FormControl<string>;
  designation: FormControl<string>;
};

@Component({
  selector: 'app-abstract-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageShell,
    AbstractFormModal,
    MatSnackBarModule,
  ],
  templateUrl: './abstract-dashboard.html',
  styleUrl: './abstract-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbstractDashboard implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  countries: string[] = [];
  countriesLoading = false;
  countriesError: string | null = null;

  abstracts: AbstractDTO[] = [];
  loading = false;
  error = '';

  savingBusy = false;

  private deletingIds = new Set<string>();

  confirmOpen = false;
  confirmBusy = false;
  confirmError = '';
  confirmTarget: AbstractDTO | null = null;

  modalOpen = false;
  modalMode: AbstractMode = 'create';
  modalAbstractId = '';
  modalInitialData?: AbstractDTO;

  readonly skeletonRows = Array.from({ length: 5 });

  // Profile gate
  profileChecking = false;
  hasProfile = true;
  profile: ProfileDTO | null = null;

  profileGateOpen = false;
  profileMode: ProfileMode = 'create';
  profileSubmitting = false;
  profileError = '';

  readonly profileForm: FormGroup<ProfileFormModel>;

  constructor(
    private api: AbstractDashboardService,
    private auth: AuthService,
    private profileApi: PresentingAuthorProfileService,
    private router: Router,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private snack: MatSnackBar,
    private readonly http: HttpClient,
  ) {
    this.profileForm = this.fb.group<ProfileFormModel>({
      title: new FormControl<TitleEnum>('Dr', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      firstName: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)],
      }),
      lastName: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)],
      }),
      country: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(120)],
      }),

      affiliation: new FormControl<string>('', { nonNullable: true }),
      department: new FormControl<string>('', { nonNullable: true }),
      city: new FormControl<string>('', { nonNullable: true }),
      designation: new FormControl<string>('', { nonNullable: true }),
    });
  }

  private toastSuccess(message: string, duration = 6500): void {
    this.snack.open(message, 'OK', {
      duration,
      panelClass: ['snack-success'],
    });
  }

  private toastError(message: string, duration = 9500): void {
    this.snack.open(message, 'Dismiss', {
      duration,
      panelClass: ['snack-error'],
    });
  }

  ngOnInit(): void {
    this.auth
      .me()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.cdr.markForCheck(), error: () => { } });

    this.checkProfileThenLoad();

    this.loadCountries();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkProfileThenLoad(): void {
    this.profileChecking = true;
    this.profileError = '';
    this.cdr.markForCheck();

    this.profileApi
      .getMyProfile()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.profileChecking = false;
          this.cdr.markForCheck();
          this.reload();
        })
      )
      .subscribe({
        next: (res: ProfileMeResponse) => {
          this.hasProfile = !!res?.hasProfile;
          this.profile = (res?.profile as any) ?? null;

          if (!this.hasProfile) {
            this.openProfileCreate();
          } else {
            this.patchProfileForm(this.profile);
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.hasProfile = false;
          this.profile = null;
          this.profileError =
            this.readApiError(err) || 'Failed to check profile.';
          this.toastError(this.profileError);

          this.openProfileCreate(true);
          this.cdr.markForCheck();
        },
      });
  }

  reload(background = false): void {
    if (this.loading && !background) return;

    if (!background) {
      this.loading = true;
      this.error = '';
      this.cdr.markForCheck();
    }

    this.api
      .listMyAbstracts()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          if (!background) {
            this.loading = false;
            this.cdr.markForCheck();
          }
        })
      )
      .subscribe({
        next: (items) => {
          this.abstracts = Array.isArray(items) ? items : [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (background && this.abstracts.length > 0) return;

          this.error = this.readApiError(err) || 'Failed to fetch abstracts.';
          if (!background) this.loading = false;

          if (!background) this.toastError(this.error);

          this.cdr.markForCheck();
        },
      });
  }

  private softRefetch(): void {
    this.reload(true);
  }

  /* ---------------------------
   * ✅ Toolbar button visibility (no arrow funcs in template)
   * --------------------------- */

  get hasAnyAbstracts(): boolean {
    return Array.isArray(this.abstracts) && this.abstracts.length > 0;
  }

  get hasSubmittedAbstracts(): boolean {
    if (!this.hasAnyAbstracts) return false;
    for (const a of this.abstracts) {
      if (this.normStatus(a) === 'submitted') return true;
    }
    return false;
  }

  get showToolbarNewAbstractButton(): boolean {
    return (
      !this.loading &&
      !this.error &&
      this.hasAnyAbstracts &&
      this.hasSubmittedAbstracts
    );
  }

  get showToolbarCreateAbstractButton(): boolean {
    return (
      !this.loading &&
      !this.error &&
      this.hasAnyAbstracts &&
      !this.hasSubmittedAbstracts
    );
  }

  /* ---------------------------
   * Header actions
   * --------------------------- */

  logout(): void {
    if (this.savingBusy || this.profileSubmitting) return;

    this.savingBusy = true;
    this.cdr.markForCheck();

    this.auth
      .logout()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.savingBusy = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => this.router.navigate(['/auth']),
        error: () => this.router.navigate(['/auth']),
      });
  }

  openProfileEdit(): void {
    if (this.profileChecking) return;

    if (!this.hasProfile) {
      this.openProfileCreate();
      return;
    }

    this.profileMode = 'edit';
    this.profileError = '';
    this.profileSubmitting = false;
    this.profileGateOpen = true;

    this.patchProfileForm(this.profile);

    this.profileForm.controls.title.disable({ emitEvent: false });
    this.profileForm.controls.firstName.disable({ emitEvent: false });
    this.profileForm.controls.lastName.disable({ emitEvent: false });
    this.profileForm.controls.country.disable({ emitEvent: false });

    this.savingBusy = true;
    this.cdr.markForCheck();
  }

  private openProfileCreate(keepError = false): void {
    this.profileMode = 'create';
    this.profileGateOpen = true;
    this.profileSubmitting = false;

    if (!keepError) this.profileError = '';

    this.profileForm.reset(
      {
        title: 'Dr',
        firstName: '',
        lastName: '',
        country: '',
        affiliation: '',
        department: '',
        city: '',
        designation: '',
      },
      { emitEvent: false }
    );

    this.profileForm.controls.title.enable({ emitEvent: false });
    this.profileForm.controls.firstName.enable({ emitEvent: false });
    this.profileForm.controls.lastName.enable({ emitEvent: false });
    this.profileForm.controls.country.enable({ emitEvent: false });

    this.savingBusy = true;
    this.cdr.markForCheck();
  }

  closeProfile(): void {
    if (this.profileMode === 'create') return;
    if (this.profileSubmitting) return;

    this.profileGateOpen = false;
    this.profileError = '';
    this.profileSubmitting = false;

    this.savingBusy =
      this.modalOpen ||
      this.confirmOpen ||
      this.confirmBusy ||
      this.deletingIds.size > 0;
    this.cdr.markForCheck();
  }

  submitProfile(): void {
    if (this.profileSubmitting) return;

    if (this.profileMode === 'create') {
      if (this.profileForm.invalid) {
        this.profileError = 'Please fill all required fields.';
        this.toastError(this.profileError);
        this.cdr.markForCheck();
        return;
      }

      const payload: Partial<ProfileDTO> = this.profileForm.getRawValue();

      this.profileSubmitting = true;
      this.profileError = '';
      this.cdr.markForCheck();

      this.profileApi
        .createMyProfile(payload)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.profileSubmitting = false;
            this.cdr.markForCheck();
          })
        )
        .subscribe({
          next: (p) => {
            this.profile = p ?? null;
            this.hasProfile = true;
            this.profileGateOpen = false;
            this.profileError = '';
            this.patchProfileForm(this.profile);

            this.toastSuccess('Profile created successfully.');

            this.savingBusy =
              this.modalOpen ||
              this.confirmOpen ||
              this.confirmBusy ||
              this.deletingIds.size > 0;
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.profileError =
              this.readApiError(err) || 'Failed to create profile.';
            this.toastError(this.profileError);
            this.cdr.markForCheck();
          },
        });

      return;
    }

    const raw = this.profileForm.getRawValue();
    const updates: Partial<ProfileDTO> = {
      affiliation: raw.affiliation || '',
      department: raw.department || '',
      city: raw.city || '',
      designation: raw.designation || '',
    };

    const changed =
      (updates.affiliation ?? '') !== (this.profile?.affiliation ?? '') ||
      (updates.department ?? '') !== (this.profile?.department ?? '') ||
      (updates.city ?? '') !== (this.profile?.city ?? '') ||
      (updates.designation ?? '') !== (this.profile?.designation ?? '');

    if (!changed) {
      this.profileError = 'No changes to update.';
      this.toastError(this.profileError);
      this.cdr.markForCheck();
      return;
    }

    this.profileSubmitting = true;
    this.profileError = '';
    this.cdr.markForCheck();

    this.profileApi
      .updateMyProfile(updates)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.profileSubmitting = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (p) => {
          this.profile = p ?? null;
          this.profileGateOpen = false;
          this.profileError = '';

          this.toastSuccess('Profile updated successfully.');

          this.savingBusy =
            this.modalOpen ||
            this.confirmOpen ||
            this.confirmBusy ||
            this.deletingIds.size > 0;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.profileError =
            this.readApiError(err) || 'Failed to update profile.';
          this.toastError(this.profileError);
          this.cdr.markForCheck();
        },
      });
  }

  private patchProfileForm(p: ProfileDTO | null): void {
    if (!p) return;

    this.profileForm.patchValue(
      {
        title: (p as any)?.title ?? 'Dr',
        firstName: (p as any)?.firstName ?? '',
        lastName: (p as any)?.lastName ?? '',
        country: (p as any)?.country ?? '',
        affiliation: (p as any)?.affiliation ?? '',
        department: (p as any)?.department ?? '',
        city: (p as any)?.city ?? '',
        designation: (p as any)?.designation ?? '',
      },
      { emitEvent: false }
    );
  }

  /* ---------------------------
   * Abstract modal controls
   * --------------------------- */

  openCreate(): void {
    if (!this.hasProfile) {
      this.openProfileCreate();
      return;
    }

    this.modalMode = 'create';
    this.modalAbstractId = '';
    this.modalInitialData = undefined;
    this.modalOpen = true;
    this.savingBusy = true;
    this.cdr.markForCheck();
  }

  openView(a: AbstractDTO): void {
    this.modalMode = 'view';
    this.modalAbstractId = this.getId(a) || '';
    this.modalInitialData = a;
    this.modalOpen = true;
    this.savingBusy = true;
    this.cdr.markForCheck();
  }

  openEdit(a: AbstractDTO): void {
    if (this.isLocked(a)) {
      this.toastError('This abstract is locked and cannot be edited.');
      return this.openView(a);
    }

    this.modalMode = 'edit';
    this.modalAbstractId = this.getId(a) || '';
    this.modalInitialData = a;
    this.modalOpen = true;
    this.savingBusy = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalAbstractId = '';
    this.modalInitialData = undefined;
    this.savingBusy =
      this.profileGateOpen ||
      this.deletingIds.size > 0 ||
      this.confirmBusy ||
      this.confirmOpen;
    this.cdr.markForCheck();
  }

  onModalSaved(dto: AbstractDTO): void {
    const id = this.getId(dto);

    if (this.modalMode === 'create') {
      this.abstracts = [dto, ...this.abstracts];
    } else if (id) {
      const idx = this.abstracts.findIndex((x) => this.getId(x) === id);
      if (idx >= 0) {
        const next = [...this.abstracts];
        next[idx] = dto;
        this.abstracts = next;
      }
    }

    this.closeModal();
    this.softRefetch();
    this.cdr.markForCheck();
  }

  /* ---------------------------
   * Delete flow
   * --------------------------- */

  askDelete(a: AbstractDTO): void {
    if (this.isLocked(a)) {
      this.toastError('This abstract is locked and cannot be deleted.');
      return;
    }

    if (this.isDeleting(a) || this.loading) return;

    this.confirmTarget = a;
    this.confirmError = '';
    this.confirmBusy = false;
    this.confirmOpen = true;
    this.savingBusy = true;
    this.cdr.markForCheck();
  }

  closeConfirm(): void {
    // (left as-is) - you can still keep the busy guard if you want
    if (this.confirmBusy) return;

    this.confirmOpen = false;
    this.confirmTarget = null;
    this.confirmError = '';
    this.savingBusy =
      this.modalOpen || this.deletingIds.size > 0 || this.profileGateOpen;
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    const target = this.confirmTarget;
    const id = this.getId(target || undefined);

    if (!target || !id || this.confirmBusy) return;

    if (this.isLocked(target)) {
      this.confirmError = 'This abstract is locked and cannot be deleted.';
      this.toastError(this.confirmError);
      this.cdr.markForCheck();
      return;
    }

    this.confirmBusy = true;
    this.confirmError = '';
    this.setDeleting(id, true);
    this.savingBusy = true;
    this.cdr.markForCheck();

    this.api
      .deleteMyAbstract(id)
      .pipe(
        takeUntil(this.destroy$),
        // ✅ Always clear busy flags (even if something throws inside next/error)
        finalize(() => {
          this.confirmBusy = false;
          this.setDeleting(id, false); // also recomputes savingBusy
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          // ✅ Close modal reliably (don’t depend on closeConfirm which may be guarded)
          this.confirmOpen = false;
          this.confirmTarget = null;
          this.confirmError = '';

          // ✅ Update UI instantly
          this.abstracts = this.abstracts.filter((x) => this.getId(x) !== id);

          // ✅ Reload in background to sync server state + toolbar conditions
          this.softRefetch();

          this.toastSuccess('Abstract deleted.');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmError =
            this.readApiError(err) || 'Failed to delete abstract.';
          this.toastError(this.confirmError);
          // keep confirmOpen=true so user can retry/cancel
          this.cdr.markForCheck();
        },
      });
  }

  isDeleting(a: AbstractDTO): boolean {
    const id = this.getId(a);
    return !!id && this.deletingIds.has(id);
  }

  private setDeleting(id: string, on: boolean): void {
    if (on) this.deletingIds.add(id);
    else this.deletingIds.delete(id);

    this.savingBusy =
      this.profileGateOpen ||
      this.modalOpen ||
      this.confirmOpen ||
      this.confirmBusy ||
      this.deletingIds.size > 0;

    this.cdr.markForCheck();
  }

  /* ---------------------------
   * Locking rules (frontend UX mirror of backend)
   * --------------------------- */

  isLocked(a: AbstractDTO): boolean {
    return this.normStatus(a) !== 'submitted';
  }

  /* ---------------------------
   * Template helpers (status/date aligned to backend)
   * --------------------------- */

  trackById = (_: number, a: AbstractDTO) => this.getId(a) ?? _;

  private normStatus(a: AbstractDTO): string {
    return String((a as any)?.status || '').trim().toLowerCase();
  }

  statusLabel(a: AbstractDTO): string {
    const s = this.normStatus(a);

    switch (s) {
      case 'submitted':
        return 'Submitted';
      case 'under-review':
      case 'under_review':
      case 'underreview':
        return 'Under Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default: {
        const pretty = s.replace(/[-_]+/g, ' ').trim();
        if (!pretty) return '—';
        return pretty.charAt(0).toUpperCase() + pretty.slice(1);
      }
    }
  }

  statusClass(a: AbstractDTO): string {
    const s = this.normStatus(a);

    switch (s) {
      case 'submitted':
        return 'chip--submitted';
      case 'under-review':
      case 'under_review':
      case 'underreview':
        return 'chip--review';
      case 'approved':
        return 'chip--approved';
      case 'rejected':
        return 'chip--rejected';
      default:
        return 'chip--other';
    }
  }

  dateLabel(a: AbstractDTO): string {
    const s = this.normStatus(a);

    switch (s) {
      case 'submitted':
        return 'Submitted';
      case 'under-review':
      case 'under_review':
      case 'underreview':
        return 'Updated';
      case 'approved':
        return 'Updated';
      case 'rejected':
        return 'Updated';
      default:
        return 'Created';
    }
  }

  dateValue(a: AbstractDTO): any {
    const anyA = a as any;
    const s = this.normStatus(a);

    if (s === 'submitted') {
      return anyA?.submittedAt ?? anyA?.createdAt ?? anyA?.created_at ?? null;
    }

    return (
      anyA?.updatedAt ??
      anyA?.updated_at ??
      anyA?.createdAt ??
      anyA?.created_at ??
      anyA?.submittedAt ??
      null
    );
  }

  formatDate(value: any): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '—';

    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  private getId(dto?: AbstractDTO | null): string | undefined {
    if (!dto) return undefined;
    return (dto as any).id || (dto as any)._id || undefined;
  }

  private readApiError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      (typeof err?.error === 'string' ? err.error : '') ||
      ''
    );
  }

  private loadCountries(): void {
    this.countriesLoading = true;
    this.countriesError = null;
    this.cdr.markForCheck();

    this.http
      .get<any[]>('https://restcountries.com/v3.1/all?fields=name')
      .subscribe({
        next: (data) => {
          this.countries = (data || [])
            .map((c: any) => c?.name?.common)
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b));

          this.countriesLoading = false;
          this.cdr.markForCheck(); // ✅ forces UI update
        },
        error: (err) => {
          this.countriesError = err?.message || 'Failed to load countries.';
          this.countries = [];
          this.countriesLoading = false;
          this.cdr.markForCheck(); // ✅ forces UI update
        },
      });
  }

}
