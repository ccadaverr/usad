import { Directive, ElementRef, inject, input, signal } from '@angular/core';
import { taskSwipeStatus } from '../board/board.logic';
import { BoardStore } from '../board/board.store';

type SwipeAction = 'start' | 'complete';

@Directive({
  selector: '[appSwipeRow]',
  exportAs: 'swipeRow',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointerleave)': 'leave($event)',
    '(pointercancel)': 'cancel($event)',
    '(lostpointercapture)': 'lostCapture($event)',
    '[class.swiping]': 'active()',
    '[class.swipe-ready]': 'progress() >= 1',
    '[class.swipe-saving]': 'saving()',
    '[style.--swipe-offset]': 'offset() + "px"',
    '[style.--swipe-progress]': 'progress()',
    '[attr.data-swipe]': 'action()',
  },
})
export class SwipeRowDirective {
  readonly taskId = input.required<string>({ alias: 'appSwipeRow' });
  readonly saving = signal(false);
  protected readonly offset = signal(0);
  protected readonly progress = signal(0);
  protected readonly active = signal(false);
  protected readonly action = signal<SwipeAction | null>(null);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly store = inject(BoardStore);
  private pointer?: { id: number; x: number; y: number; threshold: number };
  private suppressClick = false;

  open(event: MouseEvent): boolean {
    return event.detail === 0 || !this.suppressClick;
  }

  protected down(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.pointer || this.saving()) return;
    this.suppressClick = false;
    if (!this.store.canWrite() || (event.target instanceof Element &&
      event.target.closest('app-task-actions, .move-control, .drag-handle'))) return;
    const threshold = Math.max(76, Math.min(112, this.element.clientWidth * .29));
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, threshold };
  }

  protected move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.x;
    const y = event.clientY - pointer.y;
    const travel = Math.abs(x);
    if (!this.active()) {
      if (Math.abs(y) > 10 && Math.abs(y) >= travel) {
        this.suppressClick = true;
        this.settle();
        return;
      }
      if (travel < 10 || travel < Math.abs(y) * 1.3) return;
      this.suppressClick = true;
      this.active.set(true);
      this.element.setPointerCapture(event.pointerId);
    }
    if (event.cancelable) event.preventDefault();
    const action = x > 0 ? 'start' : 'complete';
    const supported = !!this.destination(action);
    const distance = supported
      ? Math.min(travel, pointer.threshold) + Math.min(24, Math.max(0, travel - pointer.threshold) * .22)
      : Math.min(16, travel * .12);
    this.action.set(supported ? action : null);
    this.progress.set(supported ? Math.min(1, travel / pointer.threshold) : 0);
    this.offset.set(Math.sign(x) * distance);
  }

  protected async up(event: PointerEvent): Promise<void> {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.x;
    const action = x > 0 ? 'start' : 'complete';
    const destination = this.active() && Math.abs(x) >= pointer.threshold ? this.destination(action) : null;
    if (!destination) {
      this.settle();
      return;
    }
    this.pointer = undefined;
    this.active.set(false);
    this.action.set(action);
    this.progress.set(1);
    this.offset.set(Math.sign(x) * Math.max(96, pointer.threshold));
    this.saving.set(true);
    try {
      await this.store.move(this.taskId(), destination);
    } finally {
      this.saving.set(false);
      this.settle();
    }
  }

  protected cancel(event: PointerEvent): void {
    if (event.pointerId === this.pointer?.id) this.settle();
  }

  protected leave(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && !this.active()) this.cancel(event);
  }

  protected lostCapture(event: PointerEvent): void {
    if (event.target === this.element) this.cancel(event);
  }

  private destination(action: SwipeAction) {
    return this.store.canWrite() ? taskSwipeStatus(this.store.tasks()[this.taskId()]?.status, action) : null;
  }

  private settle(): void {
    this.pointer = undefined;
    this.active.set(false);
    this.offset.set(0);
    this.progress.set(0);
    // Keep the action beneath the row during the snap-back transition.
  }
}
