// FILE: src/shared/check-in-console/check-in.types.ts
export type QrLifecycleStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type CheckInStatus = "NOT_CHECKED_IN" | "CHECKED_IN";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED";

export interface AttendeeDTO {
  registrationId: string;
  firstName?: string;
  lastName?: string;
  conferenceType?: string;
  email?: string;
  institution?: string;
  country?: string;
}

export interface QrDTO {
  status: QrLifecycleStatus;
  checkInStatus: CheckInStatus;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  /** Email of the staff/admin who performed the check-in, when known. */
  checkedInByEmail?: string | null;
}

export interface PreviewQrResponse {
  ok: true;
  attendee: AttendeeDTO;
  paymentStatus?: PaymentStatus;
  qr: QrDTO;
}

export interface ConfirmQrResponse {
  ok: true;
  message: string;
  alreadyCheckedIn?: boolean;
  attendee: AttendeeDTO;
  checkedInAt?: string | null;
  checkedInByEmail?: string | null;
}

export interface PreviewByRegistrationIdResponse {
  registrationId: string;
  attendee: AttendeeDTO;
  paymentStatus: PaymentStatus;
  /** Full QR block; the flat fields below are kept for older callers. */
  qr?: QrDTO;
  checkInStatus: CheckInStatus;
  checkedInAt?: string | null;
}

export interface ConfirmByRegistrationIdResponse {
  ok?: true;
  message: string;
  registrationId: string;
  attendee: AttendeeDTO;
  alreadyCheckedIn?: boolean;
  checkedInAt?: string | null;
  checkedInByEmail?: string | null;
}
