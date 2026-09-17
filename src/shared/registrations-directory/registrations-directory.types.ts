// FILE: src/shared/registrations-directory/registrations-directory.types.ts

/** Which dashboard is rendering the directory. Decides the API base + export rights. */
export type TDirectoryScope = 'admin' | 'staff';

export type TQrLifecycleStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type TCheckInStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN';

export type TRegistrationQr = {
  status: TQrLifecycleStatus;
  issuedAt?: string | null;
  expiresAt?: string | null;
  checkInStatus: TCheckInStatus;
  checkedInAt?: string | null;
  checkedInByEmail?: string | null;
};

/**
 * One row of the directory. The backend only ever returns registrations that
 * are PAID *and* have a QR issued, so `qr` is always present.
 */
export type TRegistrationRow = {
  id: string;
  registrationId: string;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  designation?: string | null;
  institution?: string | null;
  country?: string | null;
  participantCategory?: string | null;
  conferenceType?: string | null;
  email?: string | null;
  mobile?: string | null;
  registeredAt?: string | null;
  qr: TRegistrationQr;
};

export type TRegistrationsSummary = {
  total: number;
  checkedIn: number;
  notCheckedIn: number;
};

export type TRegistrationsListResponse = {
  page: number;
  limit: number;
  total: number;
  sortBy: TRegistrationSortKey;
  sortDir: TSortDir;
  items: TRegistrationRow[];
  summary: TRegistrationsSummary;
  conferenceTypes: string[];
};

export type TRegistrationSortKey =
  | 'name'
  | 'registrationId'
  | 'conferenceType'
  | 'checkedInAt'
  | 'registeredAt';

export type TSortDir = 'asc' | 'desc';

export type TRegistrationsQuery = {
  page?: number;
  limit?: number;
  q?: string;
  conferenceType?: string;
  /** '' means "any" */
  checkInStatus?: TCheckInStatus | '';
  sortBy?: TRegistrationSortKey;
  sortDir?: TSortDir;
};

/** Outcome shown in the modal after a successful manual check-in. */
export type TCheckInOutcome = {
  headline: string;
  primaryId: string;
  /** Big line: "Checked in" / "Already checked in". */
  title: string;
  /** Supporting sentence naming the delegate. */
  detail: string;
  alreadyDone: boolean;
  at: string;
};
