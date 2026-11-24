import { DeadlineComponent } from '../shared/deadline.component';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { SwipeActionsComponent } from '../shared/swipe-actions.component';
import { SwipeRowDirective } from '../shared/swipe-row.directive';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';
import { PRIORITY_LABELS, STATUSES, STATUS_LABELS, Task, TaskStatus } from './board.models';
import { BoardStore } from './board.store';

@Component({
  selector: 'app-card',
  imports: [TaskActionsComponent, DeadlineComponent, IconComponent, SwipeRowDirective, SwipeActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let record = task();
    <div class="swipe-row card-interaction" [appSwipeRow]="record.id" #swipe="swipeRow"
      [attr.aria-busy]="swipe.saving() ? 'true' : null">
      <app-swipe-actions [saving]="swipe.saving()" />
      <div class="swipe-content">
        <h3>
          <button class="task-title" type="button" (click)="swipe.open($event) && dialogs.openTask(record)">
            <span class="card-subject">{{ record.subject }}</span>
            <span>{{ record.title }}</span>
            <span class="card-meta">
              <span class="priority" [attr.data-priority]="record.priority">{{ priorityLabels[record.priority] }} priority</span>
              <app-deadline [task]="record" />
            </span>
          </button>
        </h3>
        <div class="card-controls">
          <app-task-actions [task]="record" />
          <label class="move-control">
            <span class="sr-only">Move {{ record.title }} to another stage</span>
            <select [disabled]="!store.canWrite()" (change)="move($event)">
              <option value="" selected disabled>Move to…</option>
              @for (status of statuses; track status) {
                @if (status !== record.status) {
                  <option [value]="status">{{ statusLabels[status] }}</option>
                }
              }
            </select>
            <app-icon name="chevron" />
          </label>
        </div>
      </div>
    </div>
  `,
})
export class CardComponent {
  readonly task = input.required<Task>();
  protected readonly store = inject(BoardStore);
  protected readonly dialogs = inject(DialogsService);
  protected readonly statuses = STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;

  protected move(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const status = select.value as TaskStatus;
    select.value = '';
    if (this.statuses.includes(status)) void this.store.move(this.task().id, status);
  }
}
