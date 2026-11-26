import { DialogRef } from '@angular/cdk/dialog';

/** Keep CDK's focus trap in place through a short explicit dismissal. */
export function closeDialog<T>(ref: DialogRef<T>, result?: T): void {
  const pane = ref.overlayRef.overlayElement;
  if (pane.classList.contains('dialog-closing')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !pane.getAnimations) {
    ref.close(result);
    return;
  }
  ref.disableClose = true;
  pane.classList.add('dialog-closing');
  ref.overlayRef.backdropElement?.classList.add('dialog-closing');
  Promise.allSettled(pane.getAnimations().map(animation => animation.finished)).then(() => ref.close(result));
}
