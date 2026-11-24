import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HOME_PREVIEW, HOME_REVEAL } from '../pages/home.component';
import { IconComponent } from '../shared/icon.component';
import { WorkspaceComponent } from '../workspace.component';
import { EntryBrandComponent } from './entry-brand.component';
import { GuestSession, workspaceDestination } from './guest-session.service';

interface Gesture {
  id: number;
  x: number;
  y: number;
  width: number;
  locked: boolean;
  initialOffset: number;
  initialPageOffset: number;
  sampleX: number;
  sampleTime: number;
  velocity: number;
}

@Component({
  selector: 'app-onboarding',
  imports: [EntryBrandComponent, IconComponent, NgComponentOutlet],
  host: {
    '(document:keydown)': 'keys($event)',
    '[class.tour-page-dragging]': 'dragging()',
    '[style.--tour-page-offset.px]': 'pageOffset()',
    '[style.--tour-page-progress]': 'pageProgress()',
    '[style.--tour-page-duration.ms]': 'duration()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent {
  private readonly session = inject(GuestSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly motionPreference = inject(DOCUMENT).defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  protected readonly reducedMotion = signal(this.motionPreference?.matches ?? false);
  protected readonly homePreview = WorkspaceComponent;
  protected readonly previewInjector = Injector.create({
    parent: this.injector,
    providers: [{ provide: HOME_PREVIEW, useValue: true }],
  });
  protected readonly slides = [
    { label: 'Organize', title: 'Start with one small step.',
      description: 'Capture your assignments, set priorities, and give every task a place to begin.' },
    { label: 'Progress', title: 'Move forward at your own pace.',
      description: 'Move tasks from Pending to In Progress to Completed as your work moves forward.' },
    { label: 'Grow', title: 'Watch your efforts take root.',
      description: 'Complete tasks, earn water drops, and nurture your own Munting Tanim.' },
  ];
  protected readonly index = signal(0);
  protected readonly finalSlide = computed(() => this.index() === this.slides.length - 1);
  protected readonly offset = signal(0);
  protected readonly ratio = signal(0);
  protected readonly pageOffset = signal(0);
  private readonly pageWidth = signal(1);
  protected readonly pageProgress = computed(() => this.pageOffset() / this.pageWidth());
  protected readonly dragging = signal(false);
  protected readonly duration = signal(350);
  protected readonly moved = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private pointer?: Gesture;

  constructor() {
    const change = (event: MediaQueryListEvent) => this.reducedMotion.set(event.matches);
    this.motionPreference?.addEventListener('change', change);
    this.destroyRef.onDestroy(() => this.motionPreference?.removeEventListener('change', change));
  }

  protected go(index: number): void {
    if (this.busy() || index < 0 || index >= this.slides.length || index === this.index()) return;
    this.pointer = undefined;
    this.settle(350);
    this.moved.set(true);
    this.index.set(index);
  }

  protected keys(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat ||
      (event.target instanceof Element && event.target.closest('dialog, input, textarea, select'))) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (event.key === 'ArrowRight' && this.index() === this.slides.length - 1) void this.finish('/home');
      else this.go(this.index() + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  }

  protected down(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.pointer || this.busy()) return;
    const viewport = event.currentTarget as HTMLElement;
    this.pointer = {
      id: event.pointerId, x: event.clientX, y: event.clientY, width: viewport.clientWidth,
      locked: false, initialOffset: 0, initialPageOffset: 0,
      sampleX: event.clientX, sampleTime: event.timeStamp, velocity: 0,
    };
    viewport.setPointerCapture(event.pointerId);
  }

  protected move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.locked) {
      const horizontal = Math.abs(dx);
      if (Math.abs(dy) > 9 && Math.abs(dy) >= horizontal) {
        this.pointer = undefined;
        return;
      }
      if (horizontal < 8 || horizontal < Math.abs(dy) * 1.25) return;
      pointer.locked = true;
      const active = (event.currentTarget as HTMLElement).querySelector('.tour-active');
      const transform = active ? getComputedStyle(active).transform : 'none';
      pointer.initialOffset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
      if (this.finalSlide()) {
        const frame = this.frame().nativeElement;
        const pageTransform = getComputedStyle(frame).transform;
        pointer.initialPageOffset = pageTransform === 'none' ? 0 : -new DOMMatrixReadOnly(pageTransform).m41;
        this.pageWidth.set(Math.max(1, frame.clientWidth));
      }
      this.dragging.set(true);
    }

    const elapsed = event.timeStamp - pointer.sampleTime;
    if (elapsed > 12) {
      pointer.velocity = (event.clientX - pointer.sampleX) / elapsed;
      pointer.sampleX = event.clientX;
      pointer.sampleTime = event.timeStamp;
    }
    let slideDistance = this.index() === 0 && dx > 0 ? dx * .24 : dx;
    if (this.finalSlide()) {
      const distance = dx - pointer.initialPageOffset;
      this.pageOffset.set(this.reducedMotion() ? 0 : Math.max(0, Math.min(this.pageWidth(), -distance)));
      slideDistance = Math.max(0, distance);
    }
    const delta = pointer.initialOffset + slideDistance;
    const offset = Math.max(-pointer.width, Math.min(pointer.width, delta));
    this.offset.set(offset);
    this.ratio.set(pointer.width ? offset / pointer.width : 0);
  }

  protected up(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    this.pointer = undefined;
    if (!pointer.locked) return;
    const dx = event.clientX - pointer.x;
    const direction = dx < 0 ? 1 : -1;
    const destination = this.index() + direction;
    const sinceSample = event.timeStamp - pointer.sampleTime;
    const remaining = event.clientX - pointer.sampleX;
    const velocity = destination === this.slides.length && remaining !== 0 && sinceSample > 0
      ? remaining / sinceSample : pointer.velocity;
    const flick = Math.abs(dx) > 32 && sinceSample < 105 && -direction * velocity > .5;
    if (Math.abs(dx) >= pointer.width * .24 || flick) {
      if (destination >= 0 && destination < this.slides.length) {
        this.go(destination);
        return;
      }
      if (destination === this.slides.length) {
        void this.finish('/home', true);
        return;
      }
    }
    this.settle(200);
  }

  protected cancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointer?.id) return;
    this.pointer = undefined;
    this.settle(200);
  }

  private settle(duration: number, pageOffset = 0): void {
    this.duration.set(duration);
    this.dragging.set(false);
    this.offset.set(0);
    this.ratio.set(0);
    this.pageOffset.set(pageOffset);
  }

  private async finishReveal(): Promise<void> {
    const frame = this.frame().nativeElement;
    const distance = Math.max(1, frame.clientWidth);
    this.pageWidth.set(distance);
    this.settle(280, distance);
    await new Promise<void>(resolve => {
      const unregister = this.destroyRef.onDestroy(resolve);
      afterNextRender({ read: () => {
        void Promise.allSettled(frame.getAnimations().map(animation => animation.finished)).then(() => {
          if (!this.destroyRef.destroyed) unregister();
          resolve();
        });
      } }, { injector: this.injector });
    });
  }

  protected async finish(destination = workspaceDestination(this.route.snapshot.queryParamMap.get('returnTo')), reveal = false): Promise<void> {
    if (this.busy()) return;
    this.pointer = undefined;
    this.dragging.set(false);
    this.busy.set(true);
    this.error.set('');
    let saved = false;
    try {
      await this.session.completeTour();
      saved = true;
      if (this.destroyRef.destroyed) return;
      if (reveal && !this.reducedMotion()) await this.finishReveal();
      if (this.destroyRef.destroyed) return;
      const opened = await this.router.navigateByUrl(destination, { info: reveal ? HOME_REVEAL : undefined });
      if (!opened) throw new Error('Workspace navigation was cancelled.');
    } catch {
      if (this.destroyRef.destroyed) return;
      this.settle(200);
      this.error.set(saved ? 'Your tour is saved. We couldn’t open your workspace. Please try again.'
        : 'We couldn’t save your place. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
