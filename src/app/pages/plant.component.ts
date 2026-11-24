import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { createId } from '../board/board.logic';
import { BoardStore } from '../board/board.store';
import { GardenService, GardenState } from './garden.service';
import {
  COMPLETIONS_PER_LEVEL, GARDEN_STAGES, MAX_GARDEN_LEVEL, completionsUntilGrowth, gardenLevel, stemStretch, visibleFlowers,
} from './botanical-growth';
import type { specimen } from './specimen';

@Component({
  selector: 'app-plant',
  imports: [RouterLink],
  templateUrl: './plant.component.html',
})
export class PlantComponent {
  private readonly api = inject(GardenService);
  private readonly destroy = inject(DestroyRef);
  private readonly board = inject(BoardStore);
  protected readonly state = signal<GardenState | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly watered = signal(false);
  protected readonly pendingWater = this.api.pendingWater;
  protected readonly ready = signal(false);
  protected readonly level = computed(() => this.state()?.level ?? 1);
  protected readonly stage = computed(() => GARDEN_STAGES[this.level() - 1]);
  protected readonly remaining = computed(() => completionsUntilGrowth(this.level(), this.state()?.lifetime ?? 0));
  protected readonly completionsPerLevel = COMPLETIONS_PER_LEVEL;
  protected readonly flowers = computed(() => visibleFlowers(this.level()));
  protected readonly bloomCount = computed(() => this.flowers().filter(flower => flower.blooming).length);
  protected readonly stretch = computed(() => stemStretch(this.state()?.lifetime ?? 0));
  protected readonly growthFrom = signal<number | null>(null);
  protected readonly growthNotice = signal('');
  protected readonly undoTask = this.board.undoTask;
  protected readonly canWrite = this.board.canWrite;
  protected readonly petals = [0, 72, 144, 216, 288];
  protected readonly layers = computed(() => Array.from({ length: this.level() }, (_, index) => index));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene?: ReturnType<typeof specimen>;
  private pointer?: { id: number; x: number; y: number; locked: boolean };
  private feedbackTimer?: ReturnType<typeof setTimeout>;
  private growthTimer?: ReturnType<typeof setTimeout>;
  private waterAfterGrowth = false;
  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    this.load();
    afterNextRender(() => {
      let generation = 0;
      const fallback = () => {
        this.ready.set(false);
        this.scene?.dispose();
        this.scene = undefined;
        this.pointer = undefined;
      };
      const setup = async () => {
        const token = ++generation;
        fallback();
        if (this.reduceMotion.matches) { this.growthFrom.set(null); return; }
        try {
          const { specimen } = await import('./specimen');
          if (token !== generation) return;
          this.scene = specimen(this.canvas().nativeElement, fallback);
          const state = this.state();
          if (state) this.scene.stage(state, this.growthFrom() ?? undefined);
          this.ready.set(true);
        } catch {
          fallback();
        }
      };
      const refresh = () => { if (!document.hidden && !this.pendingWater()) this.load(); };
      void setup();
      this.reduceMotion.addEventListener('change', setup);
      window.addEventListener('focus', refresh);
      this.destroy.onDestroy(() => {
        generation++;
        this.reduceMotion.removeEventListener('change', setup);
        window.removeEventListener('focus', refresh);
        fallback();
        clearTimeout(this.feedbackTimer);
        clearTimeout(this.growthTimer);
      });
    });
  }

  protected load(): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.load().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: value => this.accept(value),
      error: () => this.error.set('Could not load garden progress. Check the API connection and retry.'),
    });
  }

  protected water(): void {
    const state = this.state();
    if (!state || this.saving() || this.loading() || (!state.available && !this.pendingWater())) return;
    const id = this.pendingWater() ?? createId();
    this.pendingWater.set(id);
    this.saving.set(true);
    this.error.set('');
    this.watered.set(false);
    this.api.water(id).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
      next: value => {
        this.accept(value);
        this.pendingWater.set(null);
        if (!this.reduceMotion.matches) {
          if (this.growthFrom() === null) this.scene?.water();
          else this.waterAfterGrowth = true;
        }
        clearTimeout(this.feedbackTimer);
        this.watered.set(true);
        this.feedbackTimer = setTimeout(() => this.watered.set(false), 2600);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 409) {
          this.pendingWater.set(null);
          this.saving.set(false);
          this.load();
        } else {
          this.error.set('Could not confirm watering. Retry to check the same watering action.');
        }
      },
    });
  }

  protected async undoCompletion(): Promise<void> {
    if (await this.board.undo()) {
      this.watered.set(false);
      this.growthNotice.set('Previous task stage restored.');
    }
  }

  private accept(value: GardenState): void {
    const earned = this.board.takeGardenGrowth(value.lifetime);
    this.state.set(value);
    if (earned) {
      const previousLevel = gardenLevel(value.lifetime - 1);
      this.growthNotice.set(value.level > previousLevel
        ? `Your plant reached level ${value.level}. ${this.stage()}.`
        : value.level === MAX_GARDEN_LEVEL ? 'Your mature plant welcomed a new water drop.' : 'Your plant grew a little.');
      if (!this.reduceMotion.matches) {
        this.growthFrom.set(previousLevel);
        clearTimeout(this.growthTimer);
        this.growthTimer = setTimeout(() => {
          this.growthFrom.set(null);
          if (this.waterAfterGrowth && !this.reduceMotion.matches) this.scene?.water();
          this.waterAfterGrowth = false;
        }, 1000);
      }
    }
    this.scene?.stage(value, earned && !this.reduceMotion.matches ? this.growthFrom() ?? undefined : undefined);
  }

  protected down(event: PointerEvent): void {
    if (event.isPrimary && event.button === 0) {
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, locked: false };
    }
  }

  protected move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const delta = event.clientX - pointer.x;
    if (!pointer.locked) {
      const vertical = Math.abs(event.clientY - pointer.y);
      if (vertical > 8 && vertical >= Math.abs(delta)) { this.release(); return; }
      if (Math.abs(delta) < 7 || Math.abs(delta) < vertical * 1.25) return;
      pointer.locked = true;
      this.canvas().nativeElement.setPointerCapture(event.pointerId);
    }
    pointer.x = event.clientX;
    this.scene?.rotate(delta * .012);
  }

  protected release(): void { this.pointer = undefined; }

  protected rotate(key: KeyboardEvent): void {
    if (key.key !== 'ArrowLeft' && key.key !== 'ArrowRight') return;
    key.preventDefault();
    this.scene?.rotate(key.key === 'ArrowLeft' ? -.4 : .4);
  }
}
