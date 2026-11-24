import { Directive, ElementRef, inject, input, output, signal } from '@angular/core';

@Directive({
  selector: '[appSwipeRow]',
  exportAs: 'swipeRow',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'reset()',
    '(lostpointercapture)': 'lostCapture($event)',
    '[class.swiping]': 'active()',
    '[style.--swipe-offset]': 'offset() + "px"',
    '[attr.data-swipe]': 'direction()',
  },
})
export class SwipeRowDirective {
  readonly allowComplete = input(false);
  readonly swipeComplete = output<void>();
  readonly swipeEdit = output<void>();
  protected readonly offset = signal(0);
  protected readonly active = signal(false);
  protected readonly direction = signal<string | null>(null);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private pointer?: { id: number; x: number; y: number; threshold: number };
  private suppressClick = false;

  /** Keyboard activation always opens the task. Pointer clicks after a drag are synthetic. */
  open(event: MouseEvent): boolean {
    return !event.detail || !this.suppressClick;
  }

  protected down(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('app-task-actions')) return;
    this.suppressClick = false;
    const threshold = Math.max(56, Math.min(104, this.element.clientWidth * .24));
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, threshold };
  }

  protected move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.x;
    const y = event.clientY - pointer.y;
    if (!this.active()) {
      if (Math.abs(y) > 10 && Math.abs(y) >= Math.abs(x)) {
        this.suppressClick = true;
        this.reset();
        return;
      }
      if (Math.abs(x) < 10 || Math.abs(x) < Math.abs(y) * 1.3) return;
      this.suppressClick = true;
      this.active.set(true);
      // Capture on the row once the gesture owns the horizontal axis.
      if (this.element.isConnected) this.element.setPointerCapture(event.pointerId);
    }
    if (event.cancelable) event.preventDefault();
    this.direction.set(x > 0 ? 'edit' : this.allowComplete() ? 'complete' : null);
    const limit = this.direction() ? pointer.threshold + 24 : 18;
    this.offset.set(Math.sign(x) * Math.min(Math.abs(x), limit));
  }

  protected up(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.x;
    const committed = this.active() && Math.abs(x) >= pointer.threshold;
    this.reset();
    if (!committed) return;
    if (x > 0) this.swipeEdit.emit();
    else if (this.allowComplete()) this.swipeComplete.emit();
  }

  protected lostCapture(event: PointerEvent): void {
    if (event.target === this.element) this.reset();
  }

  protected reset(): void {
    this.pointer = undefined;
    this.active.set(false);
    this.offset.set(0);
    this.direction.set(null);
  }
}
