// FILE: src/app/admin/admin-abstract/admin-abstract.types.ts
export type IdLike = string | { _id?: string; id?: string } | null | undefined;

export type AdminOwnerRef =
  | string
  | {
      _id?: string;
      id?: string;
      email?: string;
    }
  | null
  | undefined;

export type AdminPresentingAuthorProfileRef =
  | string
  | {
      _id?: string;
      id?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      country?: string;
    }
  | null
  | undefined;

export type AdminAttachmentDTO = {
  _id?: string;
  id?: string;
  originalName?: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
};

export type AdminAbstractStatus = "submitted" | "under-review" | "approved" | "rejected";

export type AdminAbstractDTO = {
  _id?: string;
  id?: string;

  owner?: AdminOwnerRef;
  presentingAuthorProfile?: AdminPresentingAuthorProfileRef;

  presentingAuthorName?: string;
  correspondingAuthorName?: string;
  correspondingAuthorEmail?: string;

  abstractTitle?: string;
  preferredPresentationTypes?: string[];
  scientificCategories?: string[];
  otherCategoryText?: string;

  abstractText?: string;
  keywords?: string[];

  coAuthorsRaw?: string;

  attachments?: AdminAttachmentDTO[];
  status?: AdminAbstractStatus | string;

  submittedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type AdminAbstractListResponse = {
  items: AdminAbstractDTO[];
  total: number;
  page: number;
  limit: number;
};

export type AdminAbstractFilters = {
  search?: string;
  status?: "" | AdminAbstractStatus;
  ownerId?: string;
};

export function extractId(v: IdLike): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v._id || v.id || "");
}

export function extractOwnerEmail(owner: AdminOwnerRef): string {
  if (!owner) return "";
  if (typeof owner === "string") return "";
  return String(owner.email || "");
}

export function extractProfileName(profile: AdminPresentingAuthorProfileRef): string {
  if (!profile || typeof profile === "string") return "";
  const first = String(profile.firstName || "").trim();
  const last = String(profile.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  return full || "";
}

export function isValidStatus(s: any): s is AdminAbstractStatus {
  return s === "submitted" || s === "under-review" || s === "approved" || s === "rejected";
}

export function formatStatusLabel(status: any): string {
  const s = String(status || "").trim();
  if (s === "submitted") return "Submitted";
  if (s === "under-review") return "Under review";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return s || "—";
}

export function statusChipClass(status: any): string {
  const s = String(status || "").trim();
  if (s === "submitted") return "chip chip--submitted";
  if (s === "under-review") return "chip chip--review";
  if (s === "approved") return "chip chip--approved";
  if (s === "rejected") return "chip chip--rejected";
  return "chip chip--other";
}
