import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    const router = inject(Router);
    const document = inject(DOCUMENT);
    const injector = inject(Injector);
    let initial = true;
    router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      if (!initial) {
        afterNextRender(() => document.querySelector<HTMLElement>('[data-entry-main]')?.focus({ preventScroll: true }), { injector });
      }
      initial = false;
    });
  }
}
