import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { sessionExpiredInterceptor } from '../auth/session-expired.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // One HttpClient for the whole app. Components must NOT import
    // HttpClientModule themselves — a component-level provider shadows this one
    // and its requests would silently skip the interceptors below.
    provideHttpClient(withFetch(), withInterceptors([sessionExpiredInterceptor])),
  ],
};
