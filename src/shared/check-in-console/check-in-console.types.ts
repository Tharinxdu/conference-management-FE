// FILE: src/shared/check-in-console/check-in-console.types.ts

/** Which QR the operator is scanning. */
export type TCheckInMode = 'conference' | 'gala';

export type TCheckInMethod = 'scan' | 'manual';

export type TPreviewField = {
  label: string;
  value: string;
  mono?: boolean;
};

/**
 * Mode-agnostic shape for the confirmation dialog, so the template never has to
 * branch on conference vs gala. Both APIs are mapped into this before display.
 */
export type TUnifiedPreview = {
  mode: TCheckInMode;
  method: TCheckInMethod;
  headline: string;
  primaryId: string;
  fields: TPreviewField[];
  /** Already checked in / already redeemed. */
  done: boolean;
  doneAt?: string | null;
  doneByEmail?: string | null;
  /** Set when the record exists but must not be admitted (e.g. not paid). */
  blockedReason?: string | null;
};

/** Outcome shown in the modal after a successful confirmation. */
export type TCheckInResult = {
  mode: TCheckInMode;
  headline: string;
  primaryId: string;
  /** Big line: "Checked in" / "Already redeemed". */
  title: string;
  /** Supporting sentence naming the person. */
  detail: string;
  alreadyDone: boolean;
  at: string;
};

export type TRecentEntry = {
  mode: TCheckInMode;
  label: string;
  primaryId: string;
  at: string;
  alreadyDone: boolean;
};

export const MODE_META: Record<
  TCheckInMode,
  {
    label: string;
    short: string;
    icon: string;
    accent: string;
    scanTitle: string;
    scanSubtitle: string;
    scanHint: string;
    manualLabel: string;
    manualHelp: string;
    manualPlaceholder: string;
    manualMinLength: number;
    successVerb: string;
  }
> = {
  conference: {
    label: 'Conference registration',
    short: 'Conference',
    icon: '🎫',
    accent: 'rgba(56, 189, 248, 0.95)',
    scanTitle: 'Scan a registration QR',
    scanSubtitle: 'The QR emailed to delegates when their registration was paid',
    scanHint: 'Scanning CONFERENCE QR',
    manualLabel: 'Registration ID',
    manualHelp: 'Use this when the delegate’s QR will not scan.',
    manualPlaceholder: 'e.g. APSC-8F3K2P',
    manualMinLength: 3,
    successVerb: 'checked in',
  },
  gala: {
    label: 'Gala dinner ticket',
    short: 'Gala dinner',
    icon: '🍽️',
    accent: 'rgba(232, 121, 249, 0.95)',
    scanTitle: 'Scan a gala dinner QR',
    scanSubtitle: 'One QR redeems one dinner coupon',
    scanHint: 'Scanning GALA DINNER QR',
    manualLabel: 'Ticket ID',
    manualHelp: 'Use this when the ticket QR is damaged or will not scan.',
    manualPlaceholder: 'e.g. DINNER-AB12CD34',
    manualMinLength: 6,
    successVerb: 'redeemed',
  },
};
