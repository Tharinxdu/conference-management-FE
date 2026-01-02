import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  of,
  switchMap,
  tap,
  catchError,
  map,
} from 'rxjs';
import { environment } from '../environments/environment';
import {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from './auth.types';

type MeResponse = AuthUser | { user: AuthUser };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly userSubject = new BehaviorSubject<AuthUser | null>(null);
  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  private unwrapUser(res: MeResponse | null | undefined): AuthUser | null {
    if (!res) return null;
    // backend returns { user: {...} }
    if (typeof res === 'object' && 'user' in res) return (res as any).user ?? null;
    // backend returns {...} directly
    return res as AuthUser;
  }

  /** Cached /me. Returns null when not logged in. */
  me(force = false): Observable<AuthUser | null> {
    const cached = this.userSubject.value;
    if (!force && cached) return of(cached);

    return this.http
      .get<MeResponse>(`${this.baseUrl}/me`, { withCredentials: true })
      .pipe(
        map((res) => this.unwrapUser(res)),
        tap((user) => this.userSubject.next(user)),
        catchError(() => {
          this.userSubject.next(null);
          return of(null);
        })
      );
  }

  login(payload: LoginRequest): Observable<AuthUser> {
    return this.http
      .post<void>(`${this.baseUrl}/login`, payload, { withCredentials: true })
      .pipe(
        switchMap(() => this.me(true)),
        map((user) => {
          if (!user) throw new Error('Login succeeded but /me returned no user.');
          return user;
        })
      );
  }

  register(payload: RegisterRequest): Observable<AuthUser | null> {
  return this.http
    .post<void>(`${this.baseUrl}/register`, payload, { withCredentials: true })
    .pipe(map(() => null));
  }


  refresh(): Observable<AuthUser | null> {
    return this.http
      .post<void>(`${this.baseUrl}/refresh`, {}, { withCredentials: true })
      .pipe(switchMap(() => this.me(true)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.userSubject.next(null)),
        map(() => void 0),
        catchError(() => {
          this.userSubject.next(null);
          return of(void 0);
        })
      );
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<string> {
    return this.http
      .post<{ message: string }>(`${this.baseUrl}/forgot-password`, payload, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res?.message || 'If this email exists, a reset link has been sent.')
      );
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/reset-password`, payload, { withCredentials: true })
      .pipe(map(() => void 0));
  }

  /** Single source of truth for post-auth redirects. */
  getPostAuthRedirect(user: AuthUser): string {
    return user.isAdmin ? '/admin' : '/abstract-dashboard';
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }
}
