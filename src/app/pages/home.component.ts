import { DeadlineComponent } from '../shared/deadline.component';
import { TaskActionsComponent } from '../shared/task-actions.component';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, InjectionToken, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { localDate, todayISO } from '../board/board.logic';
import { BoardStore } from '../board/board.store';
import { PRIORITY_LABELS } from '../board/board.models';
import { GuestSession } from '../guest/guest-session.service';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';
import { TaskListComponent } from './task-list.component';

export const HOME_PREVIEW = new InjectionToken<boolean>('Read-only Home preview');
export const HOME_REVEAL = Symbol('Grow to Home');

@Component({
  selector: 'app-home',
  imports: [DeadlineComponent, TaskActionsComponent, DatePipe, RouterLink, IconComponent, TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly priorities = PRIORITY_LABELS;
  private readonly preview = inject(HOME_PREVIEW, { optional: true });
  protected readonly store = this.preview ? null : inject(BoardStore);
  protected readonly session = inject(GuestSession);
  protected readonly dialogs = this.preview ? null : inject(DialogsService);
  protected readonly date = computed(() => localDate(this.store?.today() ?? todayISO()));
  protected readonly agenda = computed(() => {
    if (!this.store) return [];
    const { overdue, today, tomorrow, upcoming } = this.store.deadlines();
    return [...overdue, ...today, ...tomorrow, ...upcoming].slice(0, 3);
  });
  protected readonly nextTask = computed(() => {
    if (!this.store) return undefined;
    const dates = this.store.deadlines();
    return dates.overdue[0] ?? dates.today[0] ?? dates.tomorrow[0] ?? dates.upcoming[0] ??
      this.store.columns()['in-progress'][0] ?? this.store.columns().pending[0];
  });
}
