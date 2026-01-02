import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RegisterRequest } from '../../services/auth.types';
import { PageShell } from '../../page-shell/page-shell';

type TabKey = 'loginTab' | 'registerTab';
type FormScope = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule,PageShell],
  templateUrl: './auth-component.html',
  styleUrl: './auth-component.scss',
})
export class AuthComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // --- UI state (signals = zoneless-safe)
  activeTab = signal<TabKey>('loginTab');

  loginLoading = signal(false);
  registerLoading = signal(false);
  forgotLoading = signal(false);

  loginStatus = signal('');
  registerStatus = signal('');
  forgotStatus = signal('');

  showForgotModal = signal(false);

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
    private readonly router: Router
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

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    // clear opposite status like legacy UX
    if (tab === 'loginTab') this.registerStatus.set('');
    if (tab === 'registerTab') this.loginStatus.set('');
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
      this.loginStatus.set('Please fix the highlighted errors.');
      return;
    }

    const { email, password } = this.loginForm.getRawValue() as {
      email: string;
      password: string;
    };

    this.loginLoading.set(true);
    this.loginStatus.set('Logging in…');

    this.auth
      .login({ email, password })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loginLoading.set(false))
      )
      .subscribe({
        next: (user) => {
          this.loginStatus.set('Login successful. Redirecting…');
          this.router.navigateByUrl(this.auth.getPostAuthRedirect(user));
        },
        error: (err) => {
          this.loginStatus.set(
            this.readApiError(err) || 'Login failed. Please try again.'
          );
        },
      });
  }

  onRegisterSubmit(): void {
  this.registerAttempted.set(true);
  this.registerStatus.set('');

  if (this.registerForm.invalid) {
    this.registerForm.markAllAsTouched();
    this.registerStatus.set('Please fix the highlighted errors.');
    return;
  }

  const { email, password, confirmPassword } = this.registerForm.getRawValue() as {
    email: string;
    password: string;
    confirmPassword: string;
  };

  this.registerLoading.set(true);
  this.registerStatus.set('Creating account…');

  const payload: RegisterRequest = { email, password, confirmPassword };

  this.auth
    .register(payload) 
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => this.registerLoading.set(false))
    )
    .subscribe({
      next: () => {
        // ✅ Registration success, but NOT logged in (no cookies/session yet)
        this.registerStatus.set('Account created. Please log in to continue.');

        // Switch to login tab 
        this.activeTab.set('loginTab');

        // Prefill login email for convenience (optional)
        const loginEmailControl = this.loginForm.get('email');
        if (loginEmailControl) {
          loginEmailControl.setValue(email);
          loginEmailControl.markAsTouched();
        }

        // Clear password fields on register form (optional safety UX)
        this.registerForm.get('password')?.reset('');
        this.registerForm.get('confirmPassword')?.reset('');
      },
      error: (err) => {
        this.registerStatus.set(
          this.readApiError(err) || 'Registration failed. Please try again.'
        );
      },
    });
}


  onForgotSubmit(): void {
    this.forgotAttempted.set(true);
    this.forgotStatus.set('');

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      this.forgotStatus.set('Please enter a valid email.');
      return;
    }

    const { email } = this.forgotForm.getRawValue() as { email: string };

    this.forgotLoading.set(true);
    this.forgotStatus.set('Sending reset link…');

    this.auth
      .forgotPassword({ email })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.forgotLoading.set(false))
      )
      .subscribe({
        next: (message) => {
          this.forgotStatus.set(
            message || 'If this email exists, a reset link has been sent.'
          );
        },
        error: (err) => {
          this.forgotStatus.set(
            this.readApiError(err) || 'Failed to send reset link. Please try again.'
          );
        },
      });
  }

  // --- Error mapping
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
}
