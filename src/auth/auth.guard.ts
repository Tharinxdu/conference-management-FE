import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SESSION_EXPIRED_SNACK } from './session-notice';

/**
 * Send an unauthenticated visitor to the login page — and, if they were signed
 * in earlier in this browser session, say why they were kicked out.
 */
function toLogin(router: Router, auth: AuthService): UrlTree {
  return auth.wasSignedIn()
    ? router.createUrlTree(['/auth'], { queryParams: { snack: SESSION_EXPIRED_SNACK } })
    : router.createUrlTree(['/auth']);
}

/**
 * Protects routes that require a logged-in user.
 * If not logged in -> redirects to /auth
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(map((user) => (user ? true : toLogin(router, auth))));
};

/**
 * Protects admin routes.
 * If not logged in -> /auth
 * If logged in but not admin -> /abstract-dashboard
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((user) => {
      if (!user) return toLogin(router, auth);
      return user.isAdmin ? true : router.createUrlTree(['/abstract-dashboard']);
    })
  );
};

/**
 * If user is already logged in and tries to open /auth,
 * redirect them away to the correct destination.
 */
export const authRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((user) => {
      if (!user) return true;
      return router.createUrlTree([auth.getPostAuthRedirect(user)]);
    })
  );
};

/**
 * Protects staff routes. Admins are allowed through as well, matching the
 * backend's requireStaff.
 */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((user) => {
      if (!user) return toLogin(router, auth);

      if (user.isStaff || user.isAdmin) return true;

      return router.createUrlTree(['/abstract-dashboard']);
    })
  );
};
