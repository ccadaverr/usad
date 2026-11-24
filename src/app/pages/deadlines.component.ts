import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BoardStore } from '../board/board.store';
import { TaskListComponent } from './task-list.component';

@Component({
  selector: 'app-deadlines',
  imports: [TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-intro">
      <h1>Deadlines</h1>
      <p>See the due dates for your unfinished coursework.</p>
    </div>

    <div class="deadline-groups">
      @for (group of groups; track group.id) {
        @let tasks = store.deadlines()[group.id];
        <section class="deadline-section" [attr.aria-labelledby]="'deadline-' + group.id">
          <div class="list-heading">
            <h2 [id]="'deadline-' + group.id" [attr.data-urgency]="group.id === 'overdue' || group.id === 'today' ? group.id : null">{{ group.title }}</h2>
            <span>{{ tasks.length }}</span>
          </div>
          <app-task-list [tasks]="tasks" [emptyText]="group.empty" />
        </section>
      }
    </div>
  `,
})
export class DeadlinesComponent {
  protected readonly store = inject(BoardStore);
  protected readonly groups = [
    { id: 'overdue', title: 'Overdue', empty: 'No overdue tasks.' },
    { id: 'today', title: 'Due today', empty: 'Nothing due today.' },
    { id: 'upcoming', title: 'Upcoming', empty: 'No upcoming deadlines.' },
    { id: 'undated', title: 'No due date', empty: 'Every open task has a due date.' },
  ] as const;
}
