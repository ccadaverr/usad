import { DOCUMENT } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Task } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-task-actions',
  imports: [IconComponent],
  template: `
    @if (task().status !== 'completed') {
      <button class="button complete-action" [class.completion-labeled]="labelVisible()" [disabled]="!store.canWrite()"
        [attr.aria-label]="'Complete ' + task().title" title="Complete task"
        (click)="complete($event)"><app-icon name="check" />@if (labelVisible()) { Complete }</button>

    }
  `,
})
export class TaskActionsComponent {
  readonly task = input.required<Task>();
  readonly labelVisible = input(false);
  protected readonly store = inject(BoardStore);
  private readonly document = inject(DOCUMENT);

  protected async complete(event: MouseEvent): Promise<void> {
    const saved = await this.store.move(this.task().id, 'completed');
    if (saved && event.detail === 0) {
      requestAnimationFrame(() => {
        if (this.document.activeElement === this.document.body) {
          const recovery = this.document.querySelector<HTMLElement>('.feedback button') ??
            this.document.querySelector<HTMLElement>('#content');
          recovery?.focus({ preventScroll: true });
        }
      });
    }
  }
}
