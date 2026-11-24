import { closeDialog } from './close-dialog';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

export interface ConfirmData {
  title: string;
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="confirm-dialog">
      <h2 id="confirm-title">Delete task?</h2>
      <p id="confirm-description">“{{ data.title }}” will be permanently removed from your workspace.</p>
      <div class="confirm-actions">
        <button type="button" class="button button-secondary" (click)="dismiss(ref, false)">Cancel</button>
        <button type="button" class="button button-danger" (click)="dismiss(ref, true)">Delete task</button>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  protected readonly dismiss = closeDialog;
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
