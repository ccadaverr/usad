import { DeadlineComponent } from '../shared/deadline.component';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';
import { PRIORITY_LABELS, STATUSES, STATUS_LABELS, Task, TaskStatus } from './board.models';
import { BoardStore } from './board.store';

@Component({
  selector: 'app-card',
  imports: [TaskActionsComponent, DeadlineComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let record = task();
    <div class="card-subject">{{ record.subject }}</div>
    <h3><button class="task-title" type="button" (click)="dialogs.openTask(record)">{{ record.title }}</button></h3>
    <div class="card-meta">
      <span class="priority" [attr.data-priority]="record.priority">{{ priorityLabels[record.priority] }} priority</span>
      <app-deadline [task]="record" />
    </div>
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
