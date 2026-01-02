import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../src/environments/environment';
import { AbstractDTO } from '../abstract/abstract-form-modal/abstract.types';
import { Observable } from 'rxjs';

export type SaveAllInOneUpdates = {
  presentingAuthorName: string;
  correspondingAuthorName: string;
  correspondingAuthorEmail?: string;
  abstractTitle: string;
  preferredPresentationTypes: string[];
  scientificCategories: string[];
  otherCategoryText?: string;
  abstractText: string;
  keywords: string[];
  coAuthorsRaw?: string;
};

@Injectable({ providedIn: 'root' })
export class AbstractsService {
  private readonly apiUrl = environment.apiUrl; // includes /api
  private readonly abstractsUrl = `${this.apiUrl}/abstracts`;

  constructor(private http: HttpClient) {}

  getMyAbstract(id: string): Observable<AbstractDTO> {
    return this.http.get<AbstractDTO>(
      `${this.abstractsUrl}/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  createAbstract(
    payload: {
      presentingAuthorName: string;
      correspondingAuthorName: string;
      correspondingAuthorEmail?: string;
      abstractTitle: string;
      preferredPresentationTypes: string[];
      scientificCategories: string[];
      otherCategoryText?: string;
      abstractText: string;
      keywords: string[];
      coAuthorsRaw?: string;
      declarations: {
        originalWork: boolean;
        authorsApproved: boolean;
        agreeProceedings: boolean;
      };
    },
    files: File[] = []
  ): Observable<AbstractDTO> {
    const fd = new FormData();

    // simple scalars
    fd.append('presentingAuthorName', payload.presentingAuthorName);
    fd.append('correspondingAuthorName', payload.correspondingAuthorName);
    if (payload.correspondingAuthorEmail) {
      fd.append('correspondingAuthorEmail', payload.correspondingAuthorEmail);
    }

    fd.append('abstractTitle', payload.abstractTitle);
    fd.append('abstractText', payload.abstractText);

    // ✅ arrays as JSON strings (most reliable for multipart parsing)
    fd.append(
      'preferredPresentationTypes',
      JSON.stringify(payload.preferredPresentationTypes || [])
    );
    fd.append(
      'scientificCategories',
      JSON.stringify(payload.scientificCategories || [])
    );
    fd.append('keywords', JSON.stringify(payload.keywords || []));

    if (payload.otherCategoryText) {
      fd.append('otherCategoryText', payload.otherCategoryText);
    }
    if (payload.coAuthorsRaw) {
      fd.append('coAuthorsRaw', payload.coAuthorsRaw);
    }

    // Declarations already JSON-stringified
    fd.append('declarations', JSON.stringify(payload.declarations));

    // files
    for (const f of files || []) {
      fd.append('files', f, f.name);
    }

    return this.http.post<AbstractDTO>(this.abstractsUrl, fd, {
      withCredentials: true,
    });
  }

  saveAbstractAllInOne(
    id: string,
    updatesObj: SaveAllInOneUpdates,
    removeIds: string[] = [],
    files: File[] = []
  ): Observable<AbstractDTO> {
    const fd = new FormData();

    fd.append('updates', JSON.stringify(updatesObj));

    if (removeIds && removeIds.length > 0) {
      fd.append('removeAttachmentIds', JSON.stringify(removeIds));
    }

    for (const f of files || []) {
      fd.append('files', f, f.name);
    }

    return this.http.patch<AbstractDTO>(
      `${this.abstractsUrl}/${encodeURIComponent(id)}`,
      fd,
      { withCredentials: true }
    );
  }

  deleteAbstract(id: string): Observable<{ ok: boolean; message?: string }> {
    return this.http.delete<{ ok: boolean; message?: string }>(
      `${this.abstractsUrl}/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  buildAttachmentUrl(storedName: string): string {
    const origin = this.apiUrl.replace(/\/api$/, '');
    return `${origin}/uploads/abstracts/${encodeURIComponent(storedName)}`;
  }
}
