import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, isDevMode, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

export interface GuestProfile {
  displayName: string;
  onboardingComplete: boolean;
}

interface SessionResponse {
  guest: GuestProfile | null;
}

const api = '/api/session';
const requestOptions = { timeout: 8000 };

export function workspaceDestination(value: string | null): string {
  return value && /^\/(?:home|board|deadlines|progress|garden)$/.test(value) ? value : '/home';
}

@Injectable({ providedIn: 'root' })
export class GuestSession {
  private readonly http = inject(HttpClient);
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly localDev = isDevMode() && ['localhost', '127.0.0.1', '[::1]'].includes(inject(DOCUMENT).location?.hostname ?? '');
  private readonly profileState = signal<GuestProfile | null>(null);
  private readonly statusState = signal<'checking' | 'ready' | 'unavailable'>('checking');
  private readonly connectionHintState = signal('');
  private pending?: Promise<GuestProfile | null>;
  private leaving?: Promise<void>;
  readonly profile = this.profileState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly connectionHint = this.connectionHintState.asReadonly();

  constructor() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('usad-guest-session');
    this.channel.addEventListener('message', event => {
      if (event.data === 'changed') this.browser?.location.replace('/');
    });
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  private readonly channel?: BroadcastChannel;

  private async readProfile(): Promise<GuestProfile | null> {
    const { status, body } = await firstValueFrom(this.http.get<SessionResponse>(api, {
      ...requestOptions, observe: 'response',
    }));
    if (status !== 200 || !body || (body.guest !== null && (typeof body.guest?.displayName !== 'string'
      || typeof body.guest.onboardingComplete !== 'boolean'))) {
      throw new Error('Invalid guest session response.');
    }
    return body.guest;
  }

  private changeSession<T>(action: () => Promise<T>): Promise<T> {
    const locks = this.browser?.navigator.locks;
    return locks ? locks.request('usad-guest-creation', action) : action();
  }

  ensure(): Promise<GuestProfile | null> {
    return !this.leaving && this.status() === 'ready' ? Promise.resolve(this.profile()) : this.refresh();
  }

  refresh(): Promise<GuestProfile | null> {
    const current = () => this.profile();
    return this.leaving ? this.leaving.then(current, current) : this.refreshProfile();
  }

  localApiHint(failure: unknown): string {
    if (!this.localDev) return '';
    return failure instanceof HttpErrorResponse && failure.status === 404
      ? 'The local API on port 3000 may be outdated. Restart it with npm run api:dev, then retry.'
      : 'Check that the local API is running, then retry.';
  }

  private refreshProfile(): Promise<GuestProfile | null> {
    if (this.pending) return this.pending;
    this.statusState.set('checking');
    this.connectionHintState.set('');
    this.pending = this.readProfile()
      .then(guest => {
        this.profileState.set(guest);
        this.statusState.set('ready');
        return guest;
      })
      .catch((failure: unknown) => {
        this.profileState.set(null);
        this.connectionHintState.set(this.localApiHint(failure));
        this.statusState.set('unavailable');
        return null;
      })
      .finally(() => { this.pending = undefined; });
    return this.pending;
  }

  async create(displayName: string): Promise<GuestProfile> {
    return this.changeSession(async () => {
      await firstValueFrom(this.http.post<void>(api + '/bootstrap', null, requestOptions));
      try {
        await firstValueFrom(this.http.post<SessionResponse>(api + '/guest', { displayName }, requestOptions));
      } catch (failure) {
        if (failure instanceof HttpErrorResponse && failure.status >= 400 && failure.status < 500) throw failure;
        const restored = await this.refreshProfile();
        if (restored) {
          this.channel?.postMessage('changed');
          return restored;
        }
        throw failure;
      }
      const confirmed = await this.refreshProfile();
      if (!confirmed) throw new Error('We could not confirm your workspace. Check that cookies are enabled, then try again.');
      this.channel?.postMessage('changed');
      return confirmed;
    });
  }

  leave(): Promise<void> {
    if (this.leaving) return this.leaving;
    this.leaving = this.changeSession(async () => {
      // Let any older read settle before removing the cookie, and block new reads during verification.
      await this.pending;
      const response = await firstValueFrom(this.http.post(api + '/leave', null, {
        ...requestOptions, observe: 'response', responseType: 'text',
      }));
      if (response.status !== 204 || await this.readProfile() !== null) {
        throw new Error('The browser could not verify an empty guest session.');
      }
      this.expire();
      this.channel?.postMessage('changed');
    }).finally(() => { this.leaving = undefined; });
    return this.leaving;
  }

  async completeTour(): Promise<void> {
    if (this.profile()?.onboardingComplete) return;
    const response = await firstValueFrom(this.http.post<SessionResponse>(api + '/onboarding-complete', null, requestOptions));
    if (!response.guest?.onboardingComplete) throw new Error('Onboarding was not confirmed.');
    this.profileState.set(response.guest);
  }

  expire(): void {
    this.profileState.set(null);
    this.statusState.set('ready');
  }
}

export const guestExpiryInterceptor: HttpInterceptorFn = (request, next) => {
  if (!/^\/api\/(?:tasks(?:\/|$)|garden(?:\/|$)|session\/onboarding-complete$)/.test(request.url)) return next(request);
  const session = inject(GuestSession);
  const router = inject(Router);
  return next(request).pipe(catchError((failure: HttpErrorResponse) => {
    if (failure.status === 401 && session.profile()) {
      session.expire();
      void router.navigate(['/'], { queryParams: { returnTo: workspaceDestination(router.url), expired: 1 } });
    }
    return throwError(() => failure);
  }));
};
