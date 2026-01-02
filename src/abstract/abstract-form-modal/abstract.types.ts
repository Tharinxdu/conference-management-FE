export type AbstractMode = 'create' | 'view' | 'edit';

export type PreferredPresentationType = 'ORAL' | 'POSTER' | 'EITHER';

export type ScientificCategory =
  | 'ACUTE_STROKE_MANAGEMENT'
  | 'STROKE_PREVENTION'
  | 'NEUROIMAGING_AND_DIAGNOSTICS'
  | 'REHABILITATION_AND_RECOVERY'
  | 'BASIC_AND_TRANSLATIONAL_RESEARCH'
  | 'HEALTH_SYSTEMS_AND_POLICY'
  | 'OTHER';

export interface AttachmentDTO {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt?: string | Date;

  /**
   * Optional convenience field if backend returns it.
   * If absent, frontend can construct:
   *   /uploads/abstracts/<storedName>
   */
  url?: string;
}

export interface AbstractDTO {
  // backend may return one or the other; keep flexible
  id?: string;
  _id?: string;

  presentingAuthorName: string;
  correspondingAuthorName: string;
  correspondingAuthorEmail?: string;

  abstractTitle: string;
  preferredPresentationTypes: PreferredPresentationType[] | string[];

  scientificCategories: ScientificCategory[] | string[];
  otherCategoryText?: string;

  abstractText: string;
  keywords: string[];

  coAuthorsRaw?: string;

  // derived in backend (read-only)
  coAuthors?: any[];

  // read-only backend fields
  declarations?: {
    originalWork: boolean;
    authorsApproved: boolean;
    agreeProceedings: boolean;
    acceptedAt?: string | Date | null;
  };

  attachments?: AttachmentDTO[];

  status?: string;

  createdAt?: string | Date;
  updatedAt?: string | Date;
  submittedAt?: string | Date;
}
