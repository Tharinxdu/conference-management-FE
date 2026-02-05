// FILE: src/app/auth/reset-password/reset-password.ts

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../services/auth.service';
import { ResetPasswordRequest } from '../../services/auth.types';
import { PageShell } from '../../page-shell/page-shell';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PageShell, MatSnackBarModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  token = signal<string>('');
  loading = signal(false);
  attempted = signal(false);

  showPassword = signal(false);
  showConfirmPassword = signal(false);

  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly snack: MatSnackBar
  ) {
    this.form = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [this.matchPasswords('password', 'confirmPassword')] }
    );
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((qm) => {
      const t = qm.get('token') || '';
      this.token.set(t);

      if (!t) {
        this.toastError('Reset link is missing or invalid. Please request a new one.');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }

  submit(): void {
    this.attempted.set(true);

    if (!this.token()) {
      this.toastError('Reset link is missing or invalid. Please request a new one.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastError('Please fix the highlighted errors.');
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue() as {
      password: string;
      confirmPassword: string;
    };

    const payload: ResetPasswordRequest = {
      token: this.token(),
      newPassword: password,
      confirmPassword: confirmPassword,
    };

    this.loading.set(true);

    this.auth
      .resetPassword(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: () => {
          // ✅ Redirect to login and show snackbar there
          this.router.navigate(['/auth'], {
            queryParams: { snack: 'reset-success' },
            replaceUrl: true,
          });
        },
        error: (err) => {
          this.toastError(this.readApiError(err) || 'Failed to reset password. Please try again.');
        },
      });
  }

  errorFor(controlName: 'password' | 'confirmPassword'): string {
    const ctrl = this.form.get(controlName) as AbstractControl | null;
    if (!ctrl) return '';

    const shouldShow = this.attempted() || ctrl.touched || ctrl.dirty;
    if (!shouldShow) return '';

    if (ctrl.hasError('required')) return 'This field is required.';
    if (ctrl.hasError('minlength')) {
      const req = ctrl.getError('minlength')?.requiredLength ?? 8;
      return `Password must be at least ${req} characters.`;
    }

    if (controlName === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
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

  private toastError(message: string): void {
    this.snack.open(message, 'Dismiss', {
      duration: 4500,
      panelClass: ['snack-error'],
    });
  }
}
