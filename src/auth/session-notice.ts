// FILE: src/auth/session-notice.ts

/**
 * Query-param key the login page reads to explain why the user landed there.
 * Follows the existing ?snack=... convention used for the password-reset flow.
 */
export const SESSION_EXPIRED_SNACK = 'session-expired';

export const SESSION_EXPIRED_MESSAGE =
  'Your session expired. Please sign in again to continue.';
