import { DialogRef } from '@angular/cdk/dialog';

/** Keep CDK's focus trap in place through a short explicit dismissal. */
export function closeDialog<T>(ref: DialogRef<T>, result?: T): void {
  if (ref.disableClose) return;
  const pane = ref.overlayRef.overlayElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !pane.animate) {
    ref.close(result);
    return;
  }
  ref.disableClose = true;
  const exit = pane.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.985)' }],
    { duration: 90, easing: 'ease-in', fill: 'forwards' },
  );
  exit.finished.then(() => ref.close(result), () => ref.close(result));
}
