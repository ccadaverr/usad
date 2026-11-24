import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { createId } from '../board/board.logic';
import { BoardStore } from '../board/board.store';
import { GardenService, GardenState } from './garden.service';
import type { specimen } from './specimen';

const STAGES = ['Seedling', 'Small sprout', 'Developing leaves', 'Growing plant', 'Broad foliage',
  'Branching plant', 'Mature foliage', 'Full canopy', 'Budding plant', 'In bloom'];

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
  protected readonly pendingWater = signal<string | null>(null);
  protected readonly ready = signal(false);
  protected readonly level = computed(() => this.state()?.level ?? 1);
  protected readonly stage = computed(() => STAGES[this.level() - 1]);
  protected readonly remaining = computed(() => this.level() === 10 ? 0 : this.level() * 5 - (this.state()?.lifetime ?? 0));
  protected readonly layers = computed(() => Array.from({ length: this.level() }, (_, index) => index));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene?: ReturnType<typeof specimen>;
  private pointer?: { id: number; x: number; y: number; locked: boolean };
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
    effect(() => {
      const current = this.state();
      if (current && this.scene) this.setStage(current.level);
    });
    afterNextRender(() => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
        if (reduced.matches) return;
        try {
          const { specimen } = await import('./specimen');
          if (token !== generation) return;
          this.scene = specimen(this.canvas().nativeElement, fallback);
          if (this.state()) this.setStage(this.level());
          this.ready.set(true);
        } catch {
          fallback();
        }
      };
      const refresh = () => { if (!document.hidden && !this.pendingWater()) this.load(); };
      void setup();
      reduced.addEventListener('change', setup);
      window.addEventListener('focus', refresh);
      this.destroy.onDestroy(() => {
        generation++;
        reduced.removeEventListener('change', setup);
        window.removeEventListener('focus', refresh);
        fallback();
        clearTimeout(this.feedbackTimer);
      });
    });
  }

  protected load(): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.load().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: value => this.state.set(value),
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
        this.state.set(value);
        this.pendingWater.set(null);
        this.scene?.water();
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

  private setStage(level: number): void {
    if (this.board.earnedGardenLevel() === level) {
      this.scene?.stage(level - 1);
      this.board.clearGardenMilestone();
    }
    this.scene?.stage(level);
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
