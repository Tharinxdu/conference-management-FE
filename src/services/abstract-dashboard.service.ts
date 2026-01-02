// abstract-dashboard.service.ts
import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { AbstractDTO } from '../abstract/abstract-form-modal/abstract.types';
import { environment } from '../environments/environment';

export const ABSTRACTS_API_URL = new InjectionToken<string>('ABSTRACTS_API_URL');

@Injectable({ providedIn: 'root' })
export class AbstractDashboardService {
  private readonly apiUrl: string;
  private readonly abstractsUrl: string;

  private readonly abstractsSubject = new BehaviorSubject<AbstractDTO[] | null>(null);
  readonly abstracts$ = this.abstractsSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Optional() @Inject(ABSTRACTS_API_URL) apiUrl?: string
  ) {
    const envUrl =
      (environment as any)?.apiUrl ?? (environment as any)?.API_URL ?? '';
    this.apiUrl = this.normalizeBaseUrl(apiUrl ?? envUrl ?? '');
    this.abstractsUrl = `${this.apiUrl}/abstracts`;
  }

  getCachedAbstracts(): AbstractDTO[] {
    return this.abstractsSubject.value ?? [];
  }

  setCachedAbstracts(items: AbstractDTO[]): void {
    this.abstractsSubject.next(Array.isArray(items) ? items : []);
  }

  refreshMyAbstracts(): Observable<AbstractDTO[]> {
    return this.listMyAbstracts().pipe(
      tap((items) => this.abstractsSubject.next(Array.isArray(items) ? items : []))
    );
  }

  listMyAbstracts(): Observable<AbstractDTO[]> {
    return this.http.get<AbstractDTO[]>(this.abstractsUrl, { withCredentials: true });
  }

  getMyAbstract(id: string): Observable<AbstractDTO> {
    return this.http.get<AbstractDTO>(
      `${this.abstractsUrl}/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  deleteMyAbstract(id: string): Observable<{ ok: boolean; message: string }> {
    return this.http.delete<{ ok: boolean; message: string }>(
      `${this.abstractsUrl}/${encodeURIComponent(id)}`,
      { withCredentials: true }
    );
  }

  createAbstract(payload: any, files: File[] = []): Observable<AbstractDTO> {
    const fd = new FormData();

    fd.append('presentingAuthorName', String(payload?.presentingAuthorName ?? ''));
    fd.append('correspondingAuthorName', String(payload?.correspondingAuthorName ?? ''));
    fd.append('correspondingAuthorEmail', String(payload?.correspondingAuthorEmail ?? ''));
    fd.append('abstractTitle', String(payload?.abstractTitle ?? ''));
    fd.append('otherCategoryText', String(payload?.otherCategoryText ?? ''));
    fd.append('abstractText', String(payload?.abstractText ?? ''));
    fd.append('coAuthorsRaw', String(payload?.coAuthorsRaw ?? ''));

    fd.append(
      'preferredPresentationTypes',
      JSON.stringify(payload?.preferredPresentationTypes ?? [])
    );
    fd.append('scientificCategories', JSON.stringify(payload?.scientificCategories ?? []));
    fd.append('keywords', JSON.stringify(payload?.keywords ?? []));
    fd.append('declarations', JSON.stringify(payload?.declarations ?? {}));

    for (const f of files || []) {
      fd.append('files', f, f.name);
    }

    return this.http.post<AbstractDTO>(this.abstractsUrl, fd, { withCredentials: true });
  }

  saveAbstractAllInOne(
    id: string,
    updates: any,
    removeAttachmentIds: string[] | 'ALL' = [],
    files: File[] = []
  ): Observable<AbstractDTO> {
    const fd = new FormData();

    fd.append('updates', JSON.stringify(updates ?? {}));

    if (removeAttachmentIds === 'ALL') {
      fd.append('removeAttachmentIds', 'ALL');
    } else {
      fd.append('removeAttachmentIds', JSON.stringify(removeAttachmentIds ?? []));
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

  buildAttachmentUrl(storedName: string): string {
    const clean = String(storedName || '').replace(/^\/+/, '');
    if (!clean) return '/uploads/abstracts/';
    if (!this.apiUrl) return `/uploads/abstracts/${clean}`;
    return `${this.apiUrl}/uploads/abstracts/${clean}`;
  }

  private normalizeBaseUrl(url: string): string {
    const u = String(url || '').trim();
    if (!u) return '';
    return u.replace(/\/+$/, '');
  }
}
