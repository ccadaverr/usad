import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { createId } from '../board/board.logic';
import { BoardStore } from '../board/board.store';
import { GardenService, GardenState } from './garden.service';
import { FLOWER_SITES, GARDEN_STAGES, stemStretch, visibleFlowers } from './botanical-growth';
import {
  CAN_ANCHOR_BOTTOM, CAN_DISPLAY_WIDTH, CAN_SPACE, DROP_COUNT, DROP_INTERVAL, FIRST_IMPACT, WATER_IMPACTS, WATERING_DURATION,
  FRUIT_LIMIT, PlantStage, WateringTransition, dropAge, fallingDistance, fruitAmount, mix, smooth, stageAmount,
  transitionDuration, transitionFrame, waterFlow,
} from './watering-motion';
import type { specimen } from './specimen';

const FALLBACK_FRUIT = [
  { anchor: .90, side: 1, reach: 10 }, { anchor: .65, side: -1, reach: 10 },
  { anchor: .92, side: -1, reach: 22 }, { anchor: .49, side: 1, reach: 19 },
] as const;
const FULL_TURN = 2 * Math.PI;
const SVG_POUR_X = 193;
const SVG_POUR_ANGLE = -36;
const SVG_SOIL = { x: 143, y: 166 };

@Component({
  selector: 'app-plant',
  templateUrl: './plant.component.html',
})
export class PlantComponent {
  private readonly api = inject(GardenService);
  private readonly destroy = inject(DestroyRef);
  private readonly board = inject(BoardStore);
  private readonly zone = inject(NgZone);
  protected readonly state = signal<GardenState | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly pendingWater = this.api.pendingWater;
  protected readonly ready = signal(false);
  protected readonly transition = signal<WateringTransition | null>(null);
  protected readonly level = computed(() => this.state()?.level ?? 1);
  protected readonly stage = computed(() => GARDEN_STAGES[this.level() - 1]);
  protected readonly flowers = computed(() => visibleFlowers(this.level()));
  protected readonly bloomCount = computed(() => this.flowers().filter(flower => flower.blooming).length);
  protected readonly fruitSites = FALLBACK_FRUIT;
  protected readonly fruitCount = computed(() => Math.min(this.state()?.streak ?? 0, FRUIT_LIMIT));
  protected readonly watering = computed(() => this.transition()?.kind === 'watering');
  protected readonly turning = signal(false);
  protected readonly angle = signal(0);
  protected readonly degrees = computed(() => Math.round(this.angle() * 180 / Math.PI) % 360);
  protected readonly fallbackTurn = computed(() => Math.cos(this.angle()));
  protected readonly canAnchor = `${CAN_ANCHOR_BOTTOM}px`;
  protected readonly waterBusy = computed(() => this.saving() || !!this.transition());
  protected readonly waterDisabled = computed(() =>
    !this.state() || this.waterBusy() || this.loading() || (!this.state()?.available && !this.pendingWater()),
  );
  protected readonly waterLabel = computed(() => {
    const action = this.pendingWater() && !this.saving() ? 'Retry watering' : 'Watering can';
    const available = this.state()?.available;
    return available === undefined ? action : `${action}, ${available} available water ${available === 1 ? 'drop' : 'drops'}`;
  });
  protected readonly petals = [0, 72, 144, 216, 288];
  protected readonly layers = Array.from({ length: GARDEN_STAGES.length }, (_, index) => index);
  protected readonly flowerSites = FLOWER_SITES;
  protected readonly drops = Array.from({ length: DROP_COUNT }, (_, index) => index);
  protected readonly impacts = WATER_IMPACTS;
  protected readonly soil = SVG_SOIL;
  protected readonly elapsed = signal(WATERING_DURATION);
  protected readonly motion = computed(() => transitionFrame(this.elapsed(), this.transition()?.kind ?? 'watering'));
  private readonly canvasSize = signal({ width: 360, height: 400 });
  protected readonly visibleLevel = computed(() => {
    const action = this.transition();
    return action ? mix(action.before.level, action.after.level, this.motion().growth) : this.level();
  });
  protected readonly stretch = computed(() => {
    const action = this.transition();
    return action
      ? mix(stemStretch(action.before.growth), stemStretch(action.after.growth), this.motion().growth)
      : stemStretch(this.state()?.growth ?? 0);
  });
  protected readonly spread = computed(() => {
    const action = this.transition();
    const growth = action
      ? mix(action.before.growth, action.after.growth, this.motion().growth)
      : this.state()?.growth ?? 0;
    return 1 + .009 * growth;
  });
  protected readonly fallbackCanY = computed(() => {
    const stage = this.transition()?.before.level ?? this.level();
    return Math.max(17, 78 - (stage - 1) * 7);
  });

  protected readonly fallbackFrame = computed(() => {
    const { width, height } = this.canvasSize();
    const action = this.transition();
    const top = (stage: number, growth: number) => {
      const foliage = 167 - 13 * stage - 27;
      const highest = visibleFlowers(stage).reduce((y, flower) => Math.min(y, flower.y - 17), foliage);
      return Math.min(76, 167 - (167 - highest) * stemStretch(growth) - 11);
    };
    const end = top(this.level(), this.state()?.growth ?? 0);
    const { growth, lateral } = this.motion();
    const foliageTop = action ? mix(top(action.before.level, action.before.growth), end, growth) : end;
    // The rising can needs headroom on short screens. Its resting control leaves room for
    // the specimen below while the can is up, so we can widen the view without shrinking the pot too far.
    const upper = mix(foliageTop, Math.min(foliageTop, this.fallbackCanY() - 49), lateral);
    const botanicalHeight = height - CAN_SPACE * (1 - .45 * lateral);
    const visibleWidth = mix(176, 240, lateral);
    const scale = Math.min(width / visibleWidth, botanicalHeight / (236 - upper));
    const y = (upper + 236 - botanicalHeight / scale) / 2;
    return { y, scale, height, viewBox: `${120 - width / scale / 2} ${y} ${width / scale} ${height / scale}` };
  });

  protected readonly fallbackCan = computed(() => {
    const { arrival, lateral, arc, tilt } = this.motion();
    const { y, scale, height } = this.fallbackFrame();
    const restScale = CAN_DISPLAY_WIDTH / (83 * scale);
    return {
      x: mix(120 + 6 * restScale, SVG_POUR_X, lateral) + arc * 10,
      y: mix(y + (height - CAN_ANCHOR_BOTTOM) / scale, this.fallbackCanY(), arrival) - arc * 8,
      scale: mix(restScale, 1, arrival),
      angle: SVG_POUR_ANGLE * tilt,
    };
  });

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene?: ReturnType<typeof specimen>;
  private pointer?: { id: number; startX: number; startY: number; x: number; locked: boolean };
  private animationFrame = 0;
  private reloadAfterRequest = false;
  private scope?: string | null;
  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    this.board.gardenChanges().pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.loading() || this.saving()) this.reloadAfterRequest = true;
      else this.load();
    });
    this.load();
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const size = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if (width > 0 && height > CAN_SPACE) this.canvasSize.set({ width, height });
      };
      size();
      const resize = new ResizeObserver(size);
      resize.observe(canvas);
      let generation = 0;
      const fallback = (releaseContext = false) => {
        const action = this.transition();
        if (action && this.ready()) this.elapsed.set(Math.max(0, performance.now() - action.startedAt));
        this.ready.set(false);
        this.scene?.dispose(releaseContext);
        this.scene = undefined;
        this.pointer = undefined;
        this.turning.set(false);
        if (!releaseContext) size();
      };
      const setup = async () => {
        const token = ++generation;
        fallback();
        if (this.reduceMotion.matches) {
          this.finishAnimation();
          return;
        }
        try {
          const { specimen } = await import('./specimen');
          if (token !== generation) return;
          this.scene = this.zone.runOutsideAngular(() => specimen(canvas, () => fallback(), () => this.ready.set(true)));
          const state = this.state();
          if (state) this.renderStage(state, this.transition() ?? undefined);
          this.scene.rotate(this.angle());
        } catch {
          fallback();
        }
      };
      const refresh = () => { if (!document.hidden && !this.pendingWater()) this.load(); };
      void setup();
      this.reduceMotion.addEventListener('change', setup);
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', refresh);
      const clock = this.zone.runOutsideAngular(() => window.setInterval(refresh, 60_000));
      this.destroy.onDestroy(() => {
        generation++;
        resize.disconnect();
        this.reduceMotion.removeEventListener('change', setup);
        window.removeEventListener('focus', refresh);
        document.removeEventListener('visibilitychange', refresh);
        clearInterval(clock);
        fallback(true);
      });
    });
    this.destroy.onDestroy(() => cancelAnimationFrame(this.animationFrame));
  }

  private settled(busy: typeof this.loading): void {
    busy.set(false);
    if (this.reloadAfterRequest && !this.destroy.destroyed) {
      this.reloadAfterRequest = false;
      this.load();
    }
  }

  protected load(): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.load().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.settled(this.loading))).subscribe({
      next: response => {
        const scope = response.headers.get('X-USAD-Garden-Scope');
        if (this.scope !== undefined && scope !== this.scope) {
          this.finishAnimation();
          this.state.set(null);
        }
        this.scope = scope;
        if (response.body) this.accept(response.body);
      },
      error: () => this.error.set('Could not load garden progress. Check the API connection and retry.'),
    });
  }

  protected water(event: MouseEvent): void {
    const before = this.state();
    if (event.detail > 1 || !before || this.waterDisabled()) return;
    const id = this.pendingWater() ?? createId();
    this.api.setPendingWater(id);
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.water(id).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.settled(this.saving))).subscribe({
      next: ({ wateringNumber, wateringRevision, ...value }) => {
        this.api.setPendingWater(null);
        // The POST acknowledges this operation's receipt. Compare it to the pre-request
        // snapshot so concurrent writes can advance the ledger and observed receipts stay settled.
        const newlyConfirmed = wateringNumber !== null && wateringRevision !== null
          && wateringNumber > before.waterings && wateringNumber <= value.waterings
          && wateringRevision > before.revision && wateringRevision <= value.revision;
        const action = newlyConfirmed && !this.reduceMotion.matches
          ? { before, after: value, startedAt: performance.now(), kind: 'watering' as const }
          : undefined;
        this.accept(value, action);
        this.notice.set(value.level > before.level
          ? `Plant watered. Level ${value.level} reached.`
          : 'Plant watered.');
      },
      error: (failure: HttpErrorResponse) => {
        if (failure.status === 409) {
          this.api.setPendingWater(null);
          this.reloadAfterRequest = true;
          this.notice.set('Watering could not be saved. Check your available water.');
        } else {
          this.error.set('Could not confirm watering. Retry to check the same watering action.');
        }
      },
    });
  }

  private accept(value: GardenState, action?: WateringTransition): void {
    const previous = this.state();
    if (previous && value.revision < previous.revision) return;
    this.state.set(value);
    const newFruitFrom = this.board.takeStreakMilestone(value.revision, value.streak);
    if (action) {
      this.animate(action);
    } else if (!this.transition()) {
      if (previous) {
        // Watering done elsewhere is drawn settled. Task corrections and fruit changes can animate in place.
        const before = value.waterings > previous.waterings && value.growth > previous.growth
          ? { ...value, streak: previous.streak } : previous;
        this.reconcileScene(before, value);
      } else if (newFruitFrom !== undefined) {
        this.reconcileScene({ ...value, streak: newFruitFrom }, value);
      } else {
        this.renderStage(value);
      }
    }
  }

  private reconcileScene(before: PlantStage, after: GardenState): void {
    if (!this.reduceMotion.matches && (before.growth !== after.growth
      || Math.min(before.streak, FRUIT_LIMIT) !== Math.min(after.streak, FRUIT_LIMIT))) {
      this.animate({ before, after, kind: 'reconcile', startedAt: performance.now() });
    } else {
      this.renderStage(after);
    }
  }

  private animate(action: WateringTransition): void {
    this.transition.set(action);
    this.elapsed.set(0);
    this.renderStage(action.after, action);
    this.zone.runOutsideAngular(() => {
      const tick = (time: number) => {
        const elapsed = time - action.startedAt;
        if (elapsed >= transitionDuration(action.kind)) {
          this.finishAnimation();
          const saved = this.state();
          if (saved) this.reconcileScene(action.after, saved);
          return;
        }
        if (!this.ready()) this.elapsed.set(elapsed);
        this.animationFrame = requestAnimationFrame(tick);
      };
      this.animationFrame = requestAnimationFrame(tick);
    });
  }

  private renderStage(state: PlantStage, action?: WateringTransition): void {
    this.zone.runOutsideAngular(() => this.scene?.stage(state, action));
  }

  private finishAnimation(): void {
    cancelAnimationFrame(this.animationFrame);
    this.elapsed.set(WATERING_DURATION);
    this.transition.set(null);
  }

  protected amount(stage: number): number {
    const action = this.transition();
    return action
      ? stageAmount(stage, action.before, action.after, this.motion().growth)
      : Number(stage <= this.level());
  }

  protected dropAge(index: number): number {
    return dropAge(this.elapsed(), index);
  }

  protected rippleAge(index: number): number {
    return (this.elapsed() - FIRST_IMPACT - index * DROP_INTERVAL) / 420;
  }

  private readonly nozzle = computed(() => {
    // The can holds this pose while emitting. Airborne water keeps its trajectory as the can returns.
    const angle = SVG_POUR_ANGLE * Math.PI / 180;
    return {
      x: SVG_POUR_X - 44 * Math.cos(angle) + Math.sin(angle),
      y: this.fallbackCanY() - 44 * Math.sin(angle) - Math.cos(angle),
    };
  });

  protected readonly flow = computed(() => waterFlow(this.elapsed()));
  protected readonly waterStreamPath = computed(() => {
    const { start, end } = this.flow();
    const first = this.waterPoint(start);
    const last = this.waterPoint(end);
    const middle = this.waterPoint((start + end) / 2);
    return `M${first.x} ${first.y} Q${2 * middle.x - (first.x + last.x) / 2} ${2 * middle.y - (first.y + last.y) / 2} ${last.x} ${last.y}`;
  });

  protected waterPoint(age: number, spread = 0) {
    const origin = this.nozzle();
    return {
      x: mix(origin.x, this.soil.x + spread, age),
      y: mix(origin.y, this.soil.y, fallingDistance(age)),
    };
  }

  protected readonly mix = mix;
  protected readonly smooth = smooth;

  protected fruitSize(index: number): number {
    const action = this.transition();
    return action ? fruitAmount(index, action.before.streak, action.after.streak, this.motion().growth)
      : Number(index < this.fruitCount());
  }

  protected fruitPosition(site: (typeof FALLBACK_FRUIT)[number]): string {
    return `translate(121 ${169 - 13 * this.visibleLevel() * site.anchor}) scale(${site.side} 1)`;
  }

  protected down(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.pointer) return;
    this.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX,
      locked: false };
  }

  protected move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const horizontal = event.clientX - pointer.startX;
    const vertical = Math.abs(event.clientY - pointer.startY);
    if (!pointer.locked) {
      if (Math.abs(horizontal) < vertical * 1.25 || Math.abs(horizontal) < 7) return;
      pointer.locked = true;
      this.turning.set(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    const delta = event.clientX - pointer.x;
    pointer.x = event.clientX;
    this.rotate(delta * .012);
  }

  protected leave(event: PointerEvent): void {
    if (!this.pointer?.locked) this.cancel(event);
  }

  protected cancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointer?.id) return;
    this.pointer = undefined;
    this.turning.set(false);
  }

  protected onKey(key: KeyboardEvent): void {
    switch (key.key) {
      case 'ArrowLeft':
      case 'ArrowDown': this.rotate(-.4); break;
      case 'ArrowRight':
      case 'ArrowUp': this.rotate(.4); break;
      case 'Home': this.rotate(-this.angle()); break;
      case 'End': this.rotate(359 * Math.PI / 180 - this.angle()); break;
      default: return;
    }
    key.preventDefault();
  }

  private rotate(delta: number): void {
    this.angle.update(angle => ((angle + delta) % FULL_TURN + FULL_TURN) % FULL_TURN);
    this.zone.runOutsideAngular(() => this.scene?.rotate(delta));
  }
}
