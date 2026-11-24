import { DeadlineComponent } from '../shared/deadline.component';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { localDate } from '../board/board.logic';
import { BoardStore } from '../board/board.store';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';
import { TaskListComponent } from './task-list.component';

@Component({
  selector: 'app-home',
  imports: [DeadlineComponent, TaskActionsComponent, DatePipe, RouterLink, IconComponent, TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly store = inject(BoardStore);
  protected readonly dialogs = inject(DialogsService);
  protected readonly date = localDate;
  protected readonly agenda = computed(() => {
    const { overdue, today, upcoming } = this.store.deadlines();
    return [...overdue, ...today, ...upcoming].slice(0, 3);
  });
  protected readonly nextTask = computed(() => {
    const dates = this.store.deadlines();
    return dates.overdue[0] ?? dates.today[0] ?? dates.upcoming[0] ??
      this.store.columns()['in-progress'][0] ?? this.store.columns().pending[0];
  });
}
