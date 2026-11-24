import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { deadlineContext, localDate } from '../board/board.logic';
import { Task } from '../board/board.models';
import { BoardStore } from '../board/board.store';

@Component({
  selector: 'app-deadline',
  imports: [DatePipe],
  template: `
    <span class="deadline-context" [attr.data-urgency]="context().tone">
      {{ context().label }}@if (showDate() && task().dueDate; as value) {
        <time [attr.datetime]="value"> · {{ date(value) | date:'MMM d' }}</time>
      }
    </span>
  `,
})
export class DeadlineComponent {
  readonly task = input.required<Pick<Task, 'dueDate' | 'status'>>();
  readonly showDate = input(true);
  private readonly store = inject(BoardStore);
  protected readonly date = localDate;
  protected readonly context = computed(() => deadlineContext(this.task(), this.store.today()));
}
