import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, afterNextRender, computed, inject, signal } from '@angular/core';

interface BloomPosition {
  sequence: number;
  title: string;
  x: number;
  y: number;
  row: DOMRect;
}

@Injectable()
export class CompletionMotion {
  readonly position = signal<BloomPosition | null>(null);
  readonly anchored = computed(() => {
    const position = this.position();
    return position ? [position] : [];
  });
  readonly animateInToast = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private sequence = 0;
  private lastRow?: HTMLElement;

  remember(target: EventTarget | null): void {
    if (target instanceof Element) this.lastRow = target.closest<HTMLElement>('[data-bloom-row]') ?? this.lastRow;
  }

  play(taskId: string, title: string): void {
    this.position.set(null);
    this.animateInToast.set(false);
    const view = this.document.defaultView;
    if (!view || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rows = Array.from(this.document.querySelectorAll<HTMLElement>('[data-bloom-row]'))
      .filter(element => !element.classList.contains('cdk-drag-preview') && !element.classList.contains('cdk-drag-placeholder'))
      .map(element => ({ element, bounds: element.getBoundingClientRect() }))
      .filter(({ bounds }) => bounds.height && bounds.bottom > 0 && bounds.top < view.innerHeight);
    const candidates = rows.filter(({ element }) => element.dataset['bloomRow'] === taskId);
    const source = candidates.find(({ element }) => element.contains(this.document.activeElement)) ??
      candidates.find(({ element }) => element === this.lastRow) ?? candidates[0];
    this.lastRow = undefined;
    // The featured task slot can immediately show a different assignment.
    if (source && !source.element.classList.contains('home-priority')) {
      const anchor = source.element.querySelector('.complete-action app-icon')?.getBoundingClientRect();
      this.position.set({
        sequence: ++this.sequence,
        title,
        x: anchor?.width ? anchor.x + anchor.width / 2 : source.bounds.right - 25,
        y: anchor?.height ? anchor.y + anchor.height / 2 : source.bounds.y + Math.min(24, source.bounds.height / 2),
        row: source.bounds,
      });
    } else {
      this.animateInToast.set(true);
    }

    if (!source) return;
    // CDK keeps its own transform. Reflow uses the individual translate property.
    afterNextRender({
      earlyRead: () => rows.filter(({ element }) => element.isConnected && !element.classList.contains('cdk-drag-placeholder'))
        .map(({ element, bounds }) => ({ element, delta: bounds.top - element.getBoundingClientRect().top })),
      write: moves => {
        for (const { element, delta } of moves) {
          if (Math.abs(delta) < 1 || Math.abs(delta) > 240) continue;
          element.animate?.([{ translate: `0 ${delta}px` }, { translate: '0 0' }],
            { duration: 210, easing: 'cubic-bezier(.2,.75,.25,1)' });
        }
      },
    }, { injector: this.injector });
  }

  finish(event: AnimationEvent, sequence: number): void {
    if (event.animationName === 'bloom-at-source' && this.position()?.sequence === sequence) this.position.set(null);
  }

  clearVisual(): void {
    this.position.set(null);
    this.animateInToast.set(false);
  }

  reset(): void {
    this.lastRow = undefined;
    this.clearVisual();
  }
}
