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

  /**
   * True once someone has actually signed in during this browser session.
   * Lets the guards tell "your session ran out" apart from "you were never
   * logged in", so only the former gets a session-expired message.
   */
  private hadSession = false;

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
        tap((user) => {
          if (user) this.hadSession = true;
          this.userSubject.next(user);
        }),
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

  /** Deliberate sign-out: clears the cache so guards stop seeing a stale user. */
  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.forgetSession()),
        map(() => void 0),
        catchError(() => {
          this.forgetSession();
          return of(void 0);
        })
      );
  }

  /**
   * Drop the cached user after the server rejected us (expired token), keeping
   * `hadSession` set so the login page can explain what happened.
   */
  clearSession(): void {
    this.userSubject.next(null);
  }

  /** Forget everything, including that a session ever existed. */
  private forgetSession(): void {
    this.hadSession = false;
    this.userSubject.next(null);
  }

  /** Did this browser session ever hold a signed-in user? */
  wasSignedIn(): boolean {
    return this.hadSession;
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

  resetPassword(payload: ResetPasswordRequest): Observable<string> {
    return this.http
      .post<{ message: string }>(`${this.baseUrl}/reset-password`, payload, { withCredentials: true })
      .pipe(
        map((res) => res?.message || 'Password has been reset successfully.')
      );
  }

  /** Single source of truth for post-auth redirects. */
  getPostAuthRedirect(user: AuthUser): string {
    if (user.isAdmin) return '/admin';
    if (user.isStaff) return '/staff';
    return '/abstract-dashboard';
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }
}
