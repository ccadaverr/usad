import { DOCUMENT } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Task, TaskStatus } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-task-actions',
  imports: [IconComponent],
  template: `
    @if (showStart() && task().status === 'pending') {
      <button class="btn button start-action" [disabled]="!store.canWrite()" type="button"
        [attr.aria-label]="'Start ' + task().title + ' now'" title="Start now"
        (click)="move($event, 'in-progress')"><app-icon name="arrow" />@if (labelVisible()) { Start now }</button>
    }
    @if (showComplete() && task().status !== 'completed') {
      <button class="button complete-action" [class.completion-labeled]="labelVisible()" [disabled]="!store.canWrite()"
        [attr.aria-label]="'Complete ' + task().title" title="Complete task" type="button"
        (click)="move($event, 'completed')"><app-icon name="check" />@if (labelVisible()) { Complete }</button>

    }
  `,
})
export class TaskActionsComponent {
  readonly task = input.required<Task>();
  readonly labelVisible = input(false);
  readonly showStart = input(false);
  readonly showComplete = input(true);
  protected readonly store = inject(BoardStore);
  private readonly document = inject(DOCUMENT);

  protected async move(event: MouseEvent, status: TaskStatus): Promise<void> {
    const saved = await this.store.move(this.task().id, status);
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
