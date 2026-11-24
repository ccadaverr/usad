import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

export interface GardenState {
  lifetime: number;
  level: number;
  available: number;
}

@Injectable({ providedIn: 'root' })
export class GardenService {
  private readonly http = inject(HttpClient);
  readonly pendingWater = signal<string | null>(null);

  load() {
    return this.http.get<GardenState>('/api/garden', { timeout: 8000 });
  }

  water(id: string) {
    return this.http.post<GardenState>('/api/garden/water', { id }, { timeout: 8000 });
  }
}
