import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export const APPEARANCE_KEY = 'usad.appearance';
export const APPEARANCE_MODE_KEY = 'usad.appearance-mode';
export const APPEARANCE_MODES = ['light', 'dark', 'system'] as const;
export const APPEARANCES = [
  { id: 'forest', name: 'Forest', description: 'Sage and parchment' },
  { id: 'blue-hour', name: 'Blue Hour', description: 'Slate and cool paper' },
  { id: 'warm-clay', name: 'Warm Clay', description: 'Terracotta and cream' },
] as const;

export type Appearance = (typeof APPEARANCES)[number]['id'];
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export function resolveAppearance(value: string | null | undefined): Appearance {
  return APPEARANCES.find(theme => theme.id === value)?.id ?? 'forest';
}

export function resolveAppearanceMode(value: string | null | undefined): AppearanceMode {
  return APPEARANCE_MODES.find(mode => mode === value) ?? 'system';
}

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly document = inject(DOCUMENT);
  private readonly system = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');
  private readonly chosen = signal(resolveAppearance(this.read(APPEARANCE_KEY)));
  private readonly chosenMode = signal(resolveAppearanceMode(this.read(APPEARANCE_MODE_KEY)));
  readonly selected = this.chosen.asReadonly();
  readonly mode = this.chosenMode.asReadonly();

  constructor() {
    this.apply();
    const update = () => { if (this.mode() === 'system') this.apply(); };
    this.system?.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => this.system?.removeEventListener('change', update));
  }

  select(value: Appearance): void {
    const theme = resolveAppearance(value);
    this.chosen.set(theme);
    this.apply();
    this.save(APPEARANCE_KEY, theme);
  }

  selectMode(value: AppearanceMode): void {
    const mode = resolveAppearanceMode(value);
    this.chosenMode.set(mode);
    this.apply();
    this.save(APPEARANCE_MODE_KEY, mode);
  }

  private save(key: string, value: string): void {
    try {
      this.document.defaultView?.localStorage.setItem(key, value);
    } catch { /* Browsers may deny storage. Keep the current preview usable. */ }
  }

  private read(key: string): string | null | undefined {
    try {
      return this.document.defaultView?.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private apply(): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = this.selected();
    root.dataset['mode'] = this.mode() === 'system' ? (this.system?.matches ? 'dark' : 'light') : this.mode();
    const canvas = this.document.defaultView?.getComputedStyle(root).getPropertyValue('--canvas').trim();
    if (canvas) this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas);
  }
}
