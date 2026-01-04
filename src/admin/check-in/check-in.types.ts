// FILE: src/admin/check-in/check-in.types.ts
export type QrLifecycleStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type CheckInStatus = "NOT_CHECKED_IN" | "CHECKED_IN";

export interface AttendeeDTO {
  registrationId: string;
  firstName?: string;
  lastName?: string;
  conferenceType?: string;
  email?: string;
}

export interface QrDTO {
  status: QrLifecycleStatus;
  checkInStatus: CheckInStatus;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
}

export interface PreviewQrResponse {
  ok: true;
  attendee: AttendeeDTO;
  qr: QrDTO;
}

export interface ConfirmQrResponse {
  ok: true;
  message: string;
  alreadyCheckedIn?: boolean;
  attendee: AttendeeDTO;
  checkedInAt?: string | null;
}

export interface PreviewByRegistrationIdResponse {
  registrationId: string;
  attendee: {
    firstName?: string;
    lastName?: string;
    conferenceType?: string;
  };
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED";
  checkInStatus: CheckInStatus;
  checkedInAt?: string | null;
}

export interface ConfirmByRegistrationIdResponse {
  message: string;
  registrationId: string;
  attendee: {
    firstName?: string;
    lastName?: string;
    conferenceType?: string;
  };
  alreadyCheckedIn?: boolean;
  checkedInAt?: string | null;
}
