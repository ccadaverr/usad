import { DeadlineComponent } from '../shared/deadline.component';
import { SwipeRowDirective } from '../shared/swipe-row.directive';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { localDate } from '../board/board.logic';
import { PRIORITY_LABELS, STATUS_LABELS, Task } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-task-list',
  imports: [DeadlineComponent, SwipeRowDirective, TaskActionsComponent, DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tasks().length) {
      <ul class="task-list">
        @for (task of tasks(); track task.id) {
          <li class="swipe-row" [attr.data-bloom-row]="task.id" appSwipeRow #swipe="swipeRow" [allowComplete]="task.status !== 'completed' && store.canWrite()"
            (swipeComplete)="store.move(task.id, 'completed')" (swipeEdit)="dialogs.openTask(task)">
            <div class="swipe-feedback" aria-hidden="true">
              <span class="swipe-edit">Edit</span><span class="swipe-complete">Complete</span>
            </div>
            <div class="action-row swipe-content">
            <button class="task-row" type="button" (click)="swipe.open($event) && dialogs.openTask(task)">
              @if (task.dueDate; as due) {
                <time class="date-tile" [attr.datetime]="due">
                  <span>{{ date(due) | date:'MMM' }}</span>
                  <strong>{{ date(due) | date:'d' }}</strong>
                </time>
              } @else {
                <span class="date-tile date-tile-blank" aria-hidden="true"><app-icon name="calendar" /></span>
              }
              <span class="task-row-copy">
                <strong>{{ task.title }}</strong>
                <span>{{ task.subject }} · {{ statuses[task.status] }}</span>
                <app-deadline [task]="task" [showDate]="false" />
              </span>
              <span class="priority task-row-priority" [attr.data-priority]="task.priority">{{ priorities[task.priority] }} priority</span>
              <app-icon class="row-arrow" name="arrow" />
            </button>
            <app-task-actions [task]="task" />
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
  protected readonly store = inject(BoardStore);
  protected readonly dialogs = inject(DialogsService);
  protected readonly date = localDate;
  protected readonly statuses = STATUS_LABELS;
  protected readonly priorities = PRIORITY_LABELS;

}
