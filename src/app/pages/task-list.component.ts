import { DeadlineComponent } from '../shared/deadline.component';
import { SwipeRowDirective } from '../shared/swipe-row.directive';
import { SwipeActionsComponent } from '../shared/swipe-actions.component';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { localDate } from '../board/board.logic';
import { PRIORITY_LABELS, STATUS_LABELS, Task } from '../board/board.models';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-task-list',
  imports: [DeadlineComponent, SwipeRowDirective, SwipeActionsComponent, TaskActionsComponent, DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tasks().length) {
      <ul class="task-list" [class.deadline-task-list]="!!deadlineGroup()">
        @for (task of tasks(); track task.id) {
          <li class="swipe-row" [attr.data-bloom-row]="task.id" [appSwipeRow]="task.id" #swipe="swipeRow"
            [attr.aria-busy]="swipe.saving() ? 'true' : null">
            <app-swipe-actions [saving]="swipe.saving()" />
            <div class="action-row swipe-content">
            <button class="task-row" type="button" (click)="swipe.open($event) && dialogs.openTask(task)">
              @if (!deadlineGroup()) {
                @if (task.dueDate; as due) {
                  <time class="date-tile" [attr.datetime]="due">
                    <span>{{ date(due) | date:'MMM' }}</span>
                    <strong>{{ date(due) | date:'d' }}</strong>
                  </time>
                } @else {
                  <span class="date-tile date-tile-blank" aria-hidden="true"><app-icon name="calendar" /></span>
                }
              }
              <span class="task-row-copy">
                <span class="sr-only">Edit </span><strong>{{ task.title }}</strong>
                <span>{{ task.subject }}@if (!deadlineGroup() || task.status === 'in-progress') { · {{ statuses[task.status] }}}</span>
                @if (deadlineGroup() === 'overdue') {
                  <app-deadline [task]="task" dateFormat="MMM d, y" />
                } @else if (!deadlineGroup()) {
                  <app-deadline [task]="task" [showDate]="false" />
                }
              </span>
              @if (!deadlineGroup() || task.priority === 'high') {
                <span class="priority task-row-priority" [attr.data-priority]="task.priority">{{ priorities[task.priority] }} priority</span>
              }
              <app-icon class="row-arrow" name="edit" />
            </button>
            <app-task-actions [task]="task" [showStart]="showStart()" />
            </div>
          </li>
        }
      </ul>
    } @else {
      <p class="list-empty">{{ emptyText() }}</p>
    }
  `,
})
export class TaskListComponent {
  readonly tasks = input.required<Task[]>();
  readonly emptyText = input.required<string>();
  readonly deadlineGroup = input<string>();
  readonly showStart = input(true);
  protected readonly dialogs = inject(DialogsService);
  protected readonly date = localDate;
  protected readonly statuses = STATUS_LABELS;
  protected readonly priorities = PRIORITY_LABELS;

}
