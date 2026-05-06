import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes that require a logged-in user.
 * If not logged in -> redirects to /auth
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((user) => (user ? true : router.createUrlTree(['/auth'])))
  );
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
      if (!user) return router.createUrlTree(['/auth']);
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

export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((user) => {
      if (!user) return router.createUrlTree(['/auth']);

      if (user.isStaff || user.isAdmin) return true;

      return router.createUrlTree(['/abstract-dashboard']);
    })
  );
};
