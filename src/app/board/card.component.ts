import { DeadlineComponent } from '../shared/deadline.component';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { SwipeActionsComponent } from '../shared/swipe-actions.component';
import { SwipeRowDirective } from '../shared/swipe-row.directive';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';
import { PRIORITY_LABELS, Task } from './board.models';
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
            <span class="sr-only">Edit </span><span class="card-name">{{ record.title }}</span>
            <span class="card-subject">{{ record.subject }}</span>
            <span class="card-meta">
              <app-deadline [task]="record" />
              <span class="card-priority" [attr.data-priority]="record.priority">{{ priorityLabels[record.priority] }} priority</span>
            </span>
          </button>
        </h3>
        <div class="card-controls">
          <button #moveTrigger class="btn button move-control" type="button" aria-haspopup="dialog"
            [attr.aria-label]="'Move to another stage: ' + record.title" [disabled]="!store.canWrite()"
            (click)="dialogs.openMove(record.id, moveTrigger)">
            <span>Move to</span><app-icon name="arrow" />
          </button>
          <app-task-actions [task]="record" [showComplete]="record.status === 'pending'" />
        </div>
      </div>
    </div>
  `,
})
export class CardComponent {
  readonly task = input.required<Task>();
  protected readonly store = inject(BoardStore);
  protected readonly dialogs = inject(DialogsService);
  protected readonly priorityLabels = PRIORITY_LABELS;
}
