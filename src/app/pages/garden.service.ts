import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';

export interface GardenState {
  revision: number;
  lifetime: number;
  waterings: number;
  activeWaterings: number;
  growth: number;
  level: number;
  available: number;
  streak: number;
}

export interface WateringResult extends GardenState {
  wateringNumber: number | null;
  wateringRevision: number | null;
}

const retryKey = 'usad.garden.pending-water';
const wateringId = /^[a-z\d-]{16,80}$/i;

@Injectable({ providedIn: 'root' })
export class GardenService {
  private readonly http = inject(HttpClient);
  private scope: string | null = null;
  readonly pendingWater = signal<string | null>(null);

  load() {
    return this.http.get<GardenState>('/api/garden', { timeout: 8000, observe: 'response' }).pipe(tap(response => {
      const scope = response.headers.get('X-USAD-Garden-Scope');
      if (scope === this.scope) return;
      this.scope = scope;
      this.pendingWater.set(null);
      if (!scope) return;
      try {
        const pending = JSON.parse(sessionStorage.getItem(retryKey) ?? 'null');
        if (pending?.scope === scope && typeof pending.id === 'string' && wateringId.test(pending.id)) {
          this.pendingWater.set(pending.id);
        }
      } catch {
        // A restricted browser still keeps the retry in memory for this workspace.
      }
    }));
  }

  setPendingWater(id: string | null) {
    this.pendingWater.set(id);
    if (!this.scope) return;
    try {
      if (id) sessionStorage.setItem(retryKey, JSON.stringify({ scope: this.scope, id }));
      else sessionStorage.removeItem(retryKey);
    } catch {
      // In-memory retries remain available.
    }
  }

  water(id: string) {
    const headers = this.scope ? { 'X-USAD-Garden-Scope': this.scope } : undefined;
    return this.http.post<WateringResult>('/api/garden/water', { id }, { timeout: 8000, headers });
  }
}
