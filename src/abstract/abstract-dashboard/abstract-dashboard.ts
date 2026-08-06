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

  // ✅ Abstract submission is now closed after the deadline.
  // Set this to false later if you want to reopen submissions.
  readonly abstractSubmissionClosed = false;
  readonly abstractSubmissionClosedMessage =
    'Abstract submission date has passed. New submissions, edits and deletions are now closed. You can only view your abstracts.';

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
      !this.abstractSubmissionClosed &&
      !this.loading &&
      !this.error &&
      this.hasAnyAbstracts &&
      this.hasSubmittedAbstracts
    );
  }

  get showToolbarCreateAbstractButton(): boolean {
    return (
      !this.abstractSubmissionClosed &&
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
    if (this.abstractSubmissionClosed) {
      this.toastError(this.abstractSubmissionClosedMessage);
      return;
    }

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
    if (this.abstractSubmissionClosed) {
      this.toastError('Abstract submission is closed. You can only view this abstract.');
      return this.openView(a);
    }

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
    if (this.abstractSubmissionClosed) {
      this.toastError('Abstract submission is closed. Deleting abstracts is disabled.');
      return;
    }

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

    if (this.abstractSubmissionClosed) {
      this.confirmError = 'Abstract submission is closed. Deleting abstracts is disabled.';
      this.toastError(this.confirmError);
      this.cdr.markForCheck();
      return;
    }

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
    // After the deadline, every abstract becomes view-only from this dashboard.
    if (this.abstractSubmissionClosed) return true;

    // Before the deadline, only abstracts with submitted status are editable/deletable.
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

  const hardcodedCountries: { name: string; code: string }[] = [
    { name: 'Afghanistan', code: 'AF' },
    { name: 'Åland Islands', code: 'AX' },
    { name: 'Albania', code: 'AL' },
    { name: 'Algeria', code: 'DZ' },
    { name: 'American Samoa', code: 'AS' },
    { name: 'AndorrA', code: 'AD' },
    { name: 'Angola', code: 'AO' },
    { name: 'Anguilla', code: 'AI' },
    { name: 'Antarctica', code: 'AQ' },
    { name: 'Antigua and Barbuda', code: 'AG' },
    { name: 'Argentina', code: 'AR' },
    { name: 'Armenia', code: 'AM' },
    { name: 'Aruba', code: 'AW' },
    { name: 'Australia', code: 'AU' },
    { name: 'Austria', code: 'AT' },
    { name: 'Azerbaijan', code: 'AZ' },
    { name: 'Bahamas', code: 'BS' },
    { name: 'Bahrain', code: 'BH' },
    { name: 'Bangladesh', code: 'BD' },
    { name: 'Barbados', code: 'BB' },
    { name: 'Belarus', code: 'BY' },
    { name: 'Belgium', code: 'BE' },
    { name: 'Belize', code: 'BZ' },
    { name: 'Benin', code: 'BJ' },
    { name: 'Bermuda', code: 'BM' },
    { name: 'Bhutan', code: 'BT' },
    { name: 'Bolivia', code: 'BO' },
    { name: 'Bosnia and Herzegovina', code: 'BA' },
    { name: 'Botswana', code: 'BW' },
    { name: 'Bouvet Island', code: 'BV' },
    { name: 'Brazil', code: 'BR' },
    { name: 'British Indian Ocean Territory', code: 'IO' },
    { name: 'Brunei Darussalam', code: 'BN' },
    { name: 'Bulgaria', code: 'BG' },
    { name: 'Burkina Faso', code: 'BF' },
    { name: 'Burundi', code: 'BI' },
    { name: 'Cambodia', code: 'KH' },
    { name: 'Cameroon', code: 'CM' },
    { name: 'Canada', code: 'CA' },
    { name: 'Cape Verde', code: 'CV' },
    { name: 'Cayman Islands', code: 'KY' },
    { name: 'Central African Republic', code: 'CF' },
    { name: 'Chad', code: 'TD' },
    { name: 'Chile', code: 'CL' },
    { name: 'China', code: 'CN' },
    { name: 'Christmas Island', code: 'CX' },
    { name: 'Cocos (Keeling) Islands', code: 'CC' },
    { name: 'Colombia', code: 'CO' },
    { name: 'Comoros', code: 'KM' },
    { name: 'Congo', code: 'CG' },
    { name: 'Congo, The Democratic Republic of the', code: 'CD' },
    { name: 'Cook Islands', code: 'CK' },
    { name: 'Costa Rica', code: 'CR' },
    { name: 'Cote D\'Ivoire', code: 'CI' },
    { name: 'Croatia', code: 'HR' },
    { name: 'Cuba', code: 'CU' },
    { name: 'Cyprus', code: 'CY' },
    { name: 'Czech Republic', code: 'CZ' },
    { name: 'Denmark', code: 'DK' },
    { name: 'Djibouti', code: 'DJ' },
    { name: 'Dominica', code: 'DM' },
    { name: 'Dominican Republic', code: 'DO' },
    { name: 'Ecuador', code: 'EC' },
    { name: 'Egypt', code: 'EG' },
    { name: 'El Salvador', code: 'SV' },
    { name: 'Equatorial Guinea', code: 'GQ' },
    { name: 'Eritrea', code: 'ER' },
    { name: 'Estonia', code: 'EE' },
    { name: 'Ethiopia', code: 'ET' },
    { name: 'Falkland Islands (Malvinas)', code: 'FK' },
    { name: 'Faroe Islands', code: 'FO' },
    { name: 'Fiji', code: 'FJ' },
    { name: 'Finland', code: 'FI' },
    { name: 'France', code: 'FR' },
    { name: 'French Guiana', code: 'GF' },
    { name: 'French Polynesia', code: 'PF' },
    { name: 'French Southern Territories', code: 'TF' },
    { name: 'Gabon', code: 'GA' },
    { name: 'Gambia', code: 'GM' },
    { name: 'Georgia', code: 'GE' },
    { name: 'Germany', code: 'DE' },
    { name: 'Ghana', code: 'GH' },
    { name: 'Gibraltar', code: 'GI' },
    { name: 'Greece', code: 'GR' },
    { name: 'Greenland', code: 'GL' },
    { name: 'Grenada', code: 'GD' },
    { name: 'Guadeloupe', code: 'GP' },
    { name: 'Guam', code: 'GU' },
    { name: 'Guatemala', code: 'GT' },
    { name: 'Guernsey', code: 'GG' },
    { name: 'Guinea', code: 'GN' },
    { name: 'Guinea-Bissau', code: 'GW' },
    { name: 'Guyana', code: 'GY' },
    { name: 'Haiti', code: 'HT' },
    { name: 'Heard Island and Mcdonald Islands', code: 'HM' },
    { name: 'Holy See (Vatican City State)', code: 'VA' },
    { name: 'Honduras', code: 'HN' },
    { name: 'Hong Kong', code: 'HK' },
    { name: 'Hungary', code: 'HU' },
    { name: 'Iceland', code: 'IS' },
    { name: 'India', code: 'IN' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'Iran, Islamic Republic Of', code: 'IR' },
    { name: 'Iraq', code: 'IQ' },
    { name: 'Ireland', code: 'IE' },
    { name: 'Isle of Man', code: 'IM' },
    { name: 'Israel', code: 'IL' },
    { name: 'Italy', code: 'IT' },
    { name: 'Jamaica', code: 'JM' },
    { name: 'Japan', code: 'JP' },
    { name: 'Jersey', code: 'JE' },
    { name: 'Jordan', code: 'JO' },
    { name: 'Kazakhstan', code: 'KZ' },
    { name: 'Kenya', code: 'KE' },
    { name: 'Kiribati', code: 'KI' },
    { name: 'Korea, Democratic People\'S Republic of', code: 'KP' },
    { name: 'Korea, Republic of', code: 'KR' },
    { name: 'Kuwait', code: 'KW' },
    { name: 'Kyrgyzstan', code: 'KG' },
    { name: 'Lao People\'S Democratic Republic', code: 'LA' },
    { name: 'Latvia', code: 'LV' },
    { name: 'Lebanon', code: 'LB' },
    { name: 'Lesotho', code: 'LS' },
    { name: 'Liberia', code: 'LR' },
    { name: 'Libyan Arab Jamahiriya', code: 'LY' },
    { name: 'Liechtenstein', code: 'LI' },
    { name: 'Lithuania', code: 'LT' },
    { name: 'Luxembourg', code: 'LU' },
    { name: 'Macao', code: 'MO' },
    { name: 'Macedonia, The Former Yugoslav Republic of', code: 'MK' },
    { name: 'Madagascar', code: 'MG' },
    { name: 'Malawi', code: 'MW' },
    { name: 'Malaysia', code: 'MY' },
    { name: 'Maldives', code: 'MV' },
    { name: 'Mali', code: 'ML' },
    { name: 'Malta', code: 'MT' },
    { name: 'Marshall Islands', code: 'MH' },
    { name: 'Martinique', code: 'MQ' },
    { name: 'Mauritania', code: 'MR' },
    { name: 'Mauritius', code: 'MU' },
    { name: 'Mayotte', code: 'YT' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Micronesia, Federated States of', code: 'FM' },
    { name: 'Moldova, Republic of', code: 'MD' },
    { name: 'Monaco', code: 'MC' },
    { name: 'Mongolia', code: 'MN' },
    { name: 'Montserrat', code: 'MS' },
    { name: 'Morocco', code: 'MA' },
    { name: 'Mozambique', code: 'MZ' },
    { name: 'Myanmar', code: 'MM' },
    { name: 'Namibia', code: 'NA' },
    { name: 'Nauru', code: 'NR' },
    { name: 'Nepal', code: 'NP' },
    { name: 'Netherlands', code: 'NL' },
    { name: 'Netherlands Antilles', code: 'AN' },
    { name: 'New Caledonia', code: 'NC' },
    { name: 'New Zealand', code: 'NZ' },
    { name: 'Nicaragua', code: 'NI' },
    { name: 'Niger', code: 'NE' },
    { name: 'Nigeria', code: 'NG' },
    { name: 'Niue', code: 'NU' },
    { name: 'Norfolk Island', code: 'NF' },
    { name: 'Northern Mariana Islands', code: 'MP' },
    { name: 'Norway', code: 'NO' },
    { name: 'Oman', code: 'OM' },
    { name: 'Pakistan', code: 'PK' },
    { name: 'Palau', code: 'PW' },
    { name: 'Palestinian Territory, Occupied', code: 'PS' },
    { name: 'Panama', code: 'PA' },
    { name: 'Papua New Guinea', code: 'PG' },
    { name: 'Paraguay', code: 'PY' },
    { name: 'Peru', code: 'PE' },
    { name: 'Philippines', code: 'PH' },
    { name: 'Pitcairn', code: 'PN' },
    { name: 'Poland', code: 'PL' },
    { name: 'Portugal', code: 'PT' },
    { name: 'Puerto Rico', code: 'PR' },
    { name: 'Qatar', code: 'QA' },
    { name: 'Reunion', code: 'RE' },
    { name: 'Romania', code: 'RO' },
    { name: 'Russian Federation', code: 'RU' },
    { name: 'RWANDA', code: 'RW' },
    { name: 'Saint Helena', code: 'SH' },
    { name: 'Saint Kitts and Nevis', code: 'KN' },
    { name: 'Saint Lucia', code: 'LC' },
    { name: 'Saint Pierre and Miquelon', code: 'PM' },
    { name: 'Saint Vincent and the Grenadines', code: 'VC' },
    { name: 'Samoa', code: 'WS' },
    { name: 'San Marino', code: 'SM' },
    { name: 'Sao Tome and Principe', code: 'ST' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Senegal', code: 'SN' },
    { name: 'Serbia and Montenegro', code: 'CS' },
    { name: 'Seychelles', code: 'SC' },
    { name: 'Sierra Leone', code: 'SL' },
    { name: 'Singapore', code: 'SG' },
    { name: 'Slovakia', code: 'SK' },
    { name: 'Slovenia', code: 'SI' },
    { name: 'Solomon Islands', code: 'SB' },
    { name: 'Somalia', code: 'SO' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'South Georgia and the South Sandwich Islands', code: 'GS' },
    { name: 'Spain', code: 'ES' },
    { name: 'Sri Lanka', code: 'LK' },
    { name: 'Sudan', code: 'SD' },
    { name: 'Suriname', code: 'SR' },
    { name: 'Svalbard and Jan Mayen', code: 'SJ' },
    { name: 'Swaziland', code: 'SZ' },
    { name: 'Sweden', code: 'SE' },
    { name: 'Switzerland', code: 'CH' },
    { name: 'Syrian Arab Republic', code: 'SY' },
    { name: 'Taiwan, Province of China', code: 'TW' },
    { name: 'Tajikistan', code: 'TJ' },
    { name: 'Tanzania, United Republic of', code: 'TZ' },
    { name: 'Thailand', code: 'TH' },
    { name: 'Timor-Leste', code: 'TL' },
    { name: 'Togo', code: 'TG' },
    { name: 'Tokelau', code: 'TK' },
    { name: 'Tonga', code: 'TO' },
    { name: 'Trinidad and Tobago', code: 'TT' },
    { name: 'Tunisia', code: 'TN' },
    { name: 'Turkey', code: 'TR' },
    { name: 'Turkmenistan', code: 'TM' },
    { name: 'Turks and Caicos Islands', code: 'TC' },
    { name: 'Tuvalu', code: 'TV' },
    { name: 'Uganda', code: 'UG' },
    { name: 'Ukraine', code: 'UA' },
    { name: 'United Arab Emirates', code: 'AE' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'United States', code: 'US' },
    { name: 'United States Minor Outlying Islands', code: 'UM' },
    { name: 'Uruguay', code: 'UY' },
    { name: 'Uzbekistan', code: 'UZ' },
    { name: 'Vanuatu', code: 'VU' },
    { name: 'Venezuela', code: 'VE' },
    { name: 'Viet Nam', code: 'VN' },
    { name: 'Virgin Islands, British', code: 'VG' },
    { name: 'Virgin Islands, U.S.', code: 'VI' },
    { name: 'Wallis and Futuna', code: 'WF' },
    { name: 'Western Sahara', code: 'EH' },
    { name: 'Yemen', code: 'YE' },
    { name: 'Zambia', code: 'ZM' },
    { name: 'Zimbabwe', code: 'ZW' }
  ];

  this.countries = hardcodedCountries
    .map((country) => country.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  this.countriesLoading = false;
  this.countriesError = null;
  this.cdr.markForCheck();
}

}
