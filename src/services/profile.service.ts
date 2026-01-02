import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export type ProfileDTO = {
  _id?: string;
  userId?: string;
  title: 'Dr' | 'Prof' | 'Mr' | 'Ms' | 'Other';
  firstName: string;
  lastName: string;
  email?: string;
  country: string;

  affiliation?: string;
  department?: string;
  city?: string;
  designation?: string;

  createdAt?: string;
  updatedAt?: string;
};

export type ProfileMeResponse = {
  hasProfile: boolean;
  profile: ProfileDTO | null;
};

export const PROFILE_API_URL = new InjectionToken<string>('PROFILE_API_URL');

@Injectable({ providedIn: 'root' })
export class PresentingAuthorProfileService {
  private readonly apiUrl: string;
  private readonly profileUrl: string;

  constructor(
    private http: HttpClient,
    @Optional() @Inject(PROFILE_API_URL) apiUrl?: string
  ) {
    const envUrl = (environment as any)?.apiUrl ?? (environment as any)?.API_URL ?? '';
    this.apiUrl = this.normalizeBaseUrl(apiUrl ?? envUrl ?? '');
    this.profileUrl = `${this.apiUrl}/profile`;
  }

  getMyProfile(): Observable<ProfileMeResponse> {
    return this.http.get<ProfileMeResponse>(`${this.profileUrl}/me`, { withCredentials: true });
  }

  createMyProfile(payload: Partial<ProfileDTO>): Observable<ProfileDTO> {
    return this.http.post<ProfileDTO>(`${this.profileUrl}/me`, payload ?? {}, { withCredentials: true });
  }

  updateMyProfile(updates: Partial<ProfileDTO>): Observable<ProfileDTO> {
    return this.http.put<ProfileDTO>(`${this.profileUrl}/me`, updates ?? {}, { withCredentials: true });
  }

  private normalizeBaseUrl(url: string): string {
    const u = String(url || '').trim();
    if (!u) return '';
    return u.replace(/\/+$/, '');
  }
}
