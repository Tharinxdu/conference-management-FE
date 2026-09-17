// FILE: src/auth/session-expired.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { SESSION_EXPIRED_SNACK } from './session-notice';

/**
 * The auth endpoints answer 401 as a normal "not signed in" result — the guards
 * call /auth/me on every navigation, including for visitors who never logged
 * in. Hijacking those would bounce people off the login page they just opened.
 */
function isAuthEndpoint(url: string): boolean {
  return /\/api\/auth\//.test(url);
}

/**
 * Turns an expired session into something the operator can act on.
 *
 * Access tokens are short-lived, so mid-shift a data request will eventually
 * come back 401. Without this the app just showed a generic "Something went
 * wrong" and kept the dead page up. Now it clears the stale cached user, sends
 * them to the login page, and asks them to sign in again.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      const isExpiry =
        err instanceof HttpErrorResponse && err.status === 401 && !isAuthEndpoint(req.url);

      if (isExpiry) {
        auth.clearSession();

        // Several requests can 401 at once; only the first needs to navigate.
        if (!router.url.startsWith('/auth')) {
          void router.navigate(['/auth'], {
            queryParams: { snack: SESSION_EXPIRED_SNACK },
          });
        }
      }

      return throwError(() => err);
    })
  );
};
