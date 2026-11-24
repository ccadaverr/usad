import { TestBed } from '@angular/core/testing';
import { AppearanceControlComponent } from './appearance-control.component';
import { APPEARANCE_KEY, APPEARANCE_MODE_KEY, AppearanceService, resolveAppearance, resolveAppearanceMode } from './appearance.service';

describe('Student appearance', () => {
  let saved: string | null;
  let savedMode: string | null;
  let rootTheme: string | undefined;
  let rootMode: string | undefined;
  let browserColor: string | null | undefined;
  const root = document.documentElement;
  const restoreValue = Storage.prototype.setItem;

  beforeEach(() => {
    saved = localStorage.getItem(APPEARANCE_KEY);
    savedMode = localStorage.getItem(APPEARANCE_MODE_KEY);
    rootTheme = root.dataset['theme'];
    rootMode = root.dataset['mode'];
    browserColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    localStorage.removeItem(APPEARANCE_KEY);
    localStorage.removeItem(APPEARANCE_MODE_KEY);
  });

  afterEach(() => {
    if (saved === null) localStorage.removeItem(APPEARANCE_KEY);
    else restoreValue.call(localStorage, APPEARANCE_KEY, saved);
    if (savedMode === null) localStorage.removeItem(APPEARANCE_MODE_KEY);
    else restoreValue.call(localStorage, APPEARANCE_MODE_KEY, savedMode);
    if (rootTheme === undefined) delete root.dataset['theme'];
    else root.dataset['theme'] = rootTheme;
    if (rootMode === undefined) delete root.dataset['mode'];
    else root.dataset['mode'] = rootMode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (browserColor === null) meta?.removeAttribute('content');
    else if (browserColor !== undefined) meta?.setAttribute('content', browserColor);
  });

  it('falls back to Forest for missing or invalid stored values', () => {
    localStorage.setItem(APPEARANCE_KEY, 'custom-color');
    expect(resolveAppearance(null)).toBe('forest');
    expect(TestBed.inject(AppearanceService).selected()).toBe('forest');
    expect(root.dataset['theme']).toBe('forest');
  });

  it('applies a theme immediately and initializes from the persisted preference', () => {
    TestBed.inject(AppearanceService).select('blue-hour');
    expect(root.dataset['theme']).toBe('blue-hour');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('blue-hour');
    TestBed.resetTestingModule();
    expect(TestBed.inject(AppearanceService).selected()).toBe('blue-hour');
  });

  it('persists dark mode independently and supplies distinct dark surfaces for each palette', () => {
    const appearance = TestBed.inject(AppearanceService);
    appearance.selectMode('dark');
    expect(localStorage.getItem(APPEARANCE_MODE_KEY)).toBe('dark');
    expect(root.dataset['mode']).toBe('dark');
    const surfaces = ['#141e1a', '#161d29', '#251b18'] as const;
    (['forest', 'blue-hour', 'warm-clay'] as const).forEach((theme, index) => {
      appearance.select(theme);
      expect(getComputedStyle(root).getPropertyValue('--canvas').trim()).toBe(surfaces[index]);
    });
    TestBed.resetTestingModule();
    expect(TestBed.inject(AppearanceService).mode()).toBe('dark');
    expect(root.dataset['theme']).toBe('warm-clay');
  });

  it('falls back to the live system preference and honors explicit mode overrides', () => {
    localStorage.setItem(APPEARANCE_MODE_KEY, 'ultraviolet');
    expect(resolveAppearanceMode(null)).toBe('system');
    const media = Object.assign(new EventTarget(), { matches: true });
    spyOn(window, 'matchMedia').and.returnValue(media as unknown as MediaQueryList);
    const appearance = TestBed.inject(AppearanceService);
    expect(appearance.mode()).toBe('system');
    expect(root.dataset['mode']).toBe('dark');
    media.matches = false;
    media.dispatchEvent(new Event('change'));
    expect(root.dataset['mode']).toBe('light');
    appearance.selectMode('dark');
    media.dispatchEvent(new Event('change'));
    expect(root.dataset['mode']).toBe('dark');
  });

  it('keeps the appearance usable when storage access is denied', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('Storage is blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('Storage is blocked');
    const appearance = TestBed.inject(AppearanceService);
    expect(appearance.selected()).toBe('forest');
    expect(() => appearance.select('warm-clay')).not.toThrow();
    expect(root.dataset['theme']).toBe('warm-clay');
  });

  it('opens a labeled dialog and previews the selected radio option', () => {
    const fixture = TestBed.createComponent(AppearanceControlComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.appearance-trigger')!.click();
    const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBeTrue();
    expect(dialog.querySelector('.appearance-options input:checked')?.getAttribute('aria-label')).toBe('Forest');
    dialog.querySelector<HTMLInputElement>('input[value="warm-clay"]')!.click();
    fixture.detectChanges();
    expect(dialog.querySelector('.appearance-options input:checked')?.getAttribute('aria-label')).toBe('Warm Clay');
    expect(root.dataset['theme']).toBe('warm-clay');
    expect(dialog.querySelectorAll('.appearance-swatches').length).toBe(3);
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close appearance"]')!.click();
    expect(dialog.open).toBeFalse();
  });
});
