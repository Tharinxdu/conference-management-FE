/* FILE: auth-component.ts */

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RegisterRequest } from '../../services/auth.types';
import { PageShell } from '../../page-shell/page-shell';

type TabKey = 'loginTab' | 'registerTab';
type FormScope = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PageShell, MatSnackBarModule],
  templateUrl: './auth-component.html',
  styleUrl: './auth-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // --- UI state (signals = zoneless-safe)
  activeTab = signal<TabKey>('loginTab');

  loginLoading = signal(false);
  registerLoading = signal(false);
  forgotLoading = signal(false);

  // You can keep these if you still show them in HTML,
  // but going forward prefer snackbar.
  loginStatus = signal('');
  registerStatus = signal('');
  forgotStatus = signal('');

  showForgotModal = signal(false);

  // Password visibility toggles
  showLoginPassword = signal(false);
  showRegisterPassword = signal(false);
  showRegisterConfirmPassword = signal(false);

  // Attempts (signals so template updates)
  private loginAttempted = signal(false);
  private registerAttempted = signal(false);
  private forgotAttempted = signal(false);

  // Forms
  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snack: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });

    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [this.matchPasswords('password', 'confirmPassword')] }
    );

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    // ✅ Show snackbar messages passed from other routes (e.g., reset-password success)
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((qm: ParamMap) => {
        const snackKey = qm.get('snack');
        if (!snackKey) return;

        if (snackKey === 'reset-success') {
          this.toastSuccess('Password updated. Please log in.');
          this.activeTab.set('loginTab');
          this.closeForgotModal();
        }

        // remove query param so it doesn't show again on refresh
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { snack: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });

    // If already logged in and user hits /auth, redirect away
    this.auth
      .me()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        if (user) this.router.navigateByUrl(this.auth.getPostAuthRedirect(user));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Password toggles
  toggleLoginPassword(): void {
    this.showLoginPassword.update((v) => !v);
  }

  toggleRegisterPassword(): void {
    this.showRegisterPassword.update((v) => !v);
  }

  toggleRegisterConfirmPassword(): void {
    this.showRegisterConfirmPassword.update((v) => !v);
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);

    // reset per-tab status messages
    if (tab === 'loginTab') this.registerStatus.set('');
    if (tab === 'registerTab') this.loginStatus.set('');

    // hide passwords when switching tabs
    this.showLoginPassword.set(false);
    this.showRegisterPassword.set(false);
    this.showRegisterConfirmPassword.set(false);
  }

  openForgotModal(): void {
    this.showForgotModal.set(true);
    this.forgotStatus.set('');
    this.forgotAttempted.set(false);

    this.forgotForm.reset({ email: this.loginForm.get('email')?.value || '' });
  }

  closeForgotModal(): void {
    this.showForgotModal.set(false);
  }

  onLoginSubmit(): void {
    this.loginAttempted.set(true);
    this.loginStatus.set('');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.toastError('Please fix the highlighted errors.');
      return;
    }

    const { email, password } = this.loginForm.getRawValue() as {
      email: string;
      password: string;
    };

    this.loginLoading.set(true);

    this.auth
      .login({ email, password })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loginLoading.set(false))
      )
      .subscribe({
        next: (user) => {
          this.toastSuccess('Login successful. Redirecting…');
          this.router.navigateByUrl(this.auth.getPostAuthRedirect(user));
        },
        error: (err) => {
          this.toastError(this.readApiError(err) || 'Login failed. Please try again.');
        },
      });
  }

  onRegisterSubmit(): void {
    this.registerAttempted.set(true);
    this.registerStatus.set('');

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.toastError('Please fix the highlighted errors.');
      return;
    }

    const { email, password, confirmPassword } = this.registerForm.getRawValue() as {
      email: string;
      password: string;
      confirmPassword: string;
    };

    this.registerLoading.set(true);

    const payload: RegisterRequest = { email, password, confirmPassword };

    this.auth
      .register(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.registerLoading.set(false))
      )
      .subscribe({
        next: () => {
          this.toastSuccess('Account created. Please log in to continue.');

          // Switch to login tab + prefill email
          this.activeTab.set('loginTab');
          this.loginForm.get('email')?.setValue(email);
          this.loginForm.get('email')?.markAsTouched();

          // Clear register password fields
          this.registerForm.get('password')?.reset('');
          this.registerForm.get('confirmPassword')?.reset('');

          // Hide password visibility toggles
          this.showRegisterPassword.set(false);
          this.showRegisterConfirmPassword.set(false);
        },
        error: (err) => {
          this.toastError(this.readApiError(err) || 'Registration failed. Please try again.');
        },
      });
  }

  onForgotSubmit(): void {
    this.forgotAttempted.set(true);
    this.forgotStatus.set('');

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      this.toastError('Please enter a valid email.');
      return;
    }

    const { email } = this.forgotForm.getRawValue() as { email: string };

    this.forgotLoading.set(true);

    this.auth
      .forgotPassword({ email })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.forgotLoading.set(false))
      )
      .subscribe({
        next: () => {
          this.toastSuccess('If this email exists, a reset link has been sent.');
        },
        error: (err) => {
          this.toastError(this.readApiError(err) || 'Failed to send reset link. Please try again.');
        },
      });
  }

  // --- Error mapping (used under inputs)
  errorFor(form: FormGroup, controlName: string, scope: FormScope): string {
    const ctrl = form.get(controlName) as AbstractControl | null;
    if (!ctrl) return '';

    const attempted =
      scope === 'login'
        ? this.loginAttempted()
        : scope === 'register'
        ? this.registerAttempted()
        : this.forgotAttempted();

    const shouldShow = attempted || ctrl.touched || ctrl.dirty;
    if (!shouldShow) return '';

    if (ctrl.hasError('required')) return 'This field is required.';
    if (ctrl.hasError('email')) return 'Please enter a valid email address.';

    if (ctrl.hasError('minlength')) {
      const req = ctrl.getError('minlength')?.requiredLength ?? 8;
      return `Password must be at least ${req} characters.`;
    }

    if (controlName === 'confirmPassword' && form.hasError('passwordMismatch')) {
      return 'Passwords do not match.';
    }

    return '';
  }

  private matchPasswords(passwordKey: string, confirmKey: string) {
    return (group: AbstractControl): ValidationErrors | null => {
      const password = group.get(passwordKey)?.value;
      const confirm = group.get(confirmKey)?.value;
      if (!password || !confirm) return null;
      return password === confirm ? null : { passwordMismatch: true };
    };
  }

  private readApiError(err: any): string {
    return err?.error?.message || err?.error?.error || err?.message || '';
  }

  private toastSuccess(message: string): void {
    this.snack.open(message, 'OK', {
      duration: 6500,
      panelClass: ['snack-success'],
    });
  }

  private toastError(message: string): void {
    this.snack.open(message, 'Dismiss', {
      duration: 9500,
      panelClass: ['snack-error'],
    });
  }
}
