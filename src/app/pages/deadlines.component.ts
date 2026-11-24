import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BoardStore } from '../board/board.store';
import { IconComponent } from '../shared/icon.component';
import { TaskListComponent } from './task-list.component';

const urgentGroups = [
  { id: 'overdue', title: 'Overdue', lead: 'Start here' },
  { id: 'today', title: 'Due today', lead: 'Today’s focus' },
  { id: 'tomorrow', title: 'Due tomorrow', lead: 'Plan ahead' },
] as const;

@Component({
  selector: 'app-deadlines',
  imports: [IconComponent, TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-intro compact-page-intro">
      <h1>Deadlines</h1>
      <p>See the due dates for your unfinished coursework.</p>
    </div>

    @let deadlines = store.deadlines();
    @let lead = nextUrgency();
    <section class="deadline-brief" aria-label="Deadline summary">
      @if (lead) {
        <div class="deadline-lead" [attr.data-urgency]="lead.id">
          <p class="deadline-kicker">{{ lead.lead }}</p>
          <h2><strong>{{ deadlines[lead.id].length }}</strong> {{ lead.title }}</h2>
        </div>
      } @else {
        <div class="deadline-lead deadline-calm">
          <app-icon name="sprout" />
          <h2>Nothing urgent</h2>
          <p>{{ store.stats().remaining ? 'No open tasks due through tomorrow.' :
            store.stats().total ? 'You’ve finished your open tasks.' : 'Add a due date to see it here.' }}</p>
        </div>
      }
      <dl class="deadline-brief-counts">
        @for (group of urgent; track group.id) {
          @if (group.id !== lead?.id) {
            <div>
              <dt>{{ group.title }}</dt>
              <dd [attr.data-urgency]="deadlines[group.id].length ? group.id : null">{{ deadlines[group.id].length }}</dd>
            </div>
          }
        }
      </dl>
    </section>

    @if (store.stats().remaining) {
      <div class="deadline-groups">
        @for (group of groups; track group.id) {
          @let tasks = deadlines[group.id];
          @if (tasks.length) {
            <section class="deadline-section" [attr.data-deadline-group]="group.id" [attr.aria-labelledby]="'deadline-' + group.id">
              <header class="deadline-section-heading">
                <h2 [id]="'deadline-' + group.id">{{ group.title }}</h2>
                <span>{{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }}</span>
              </header>
              <app-task-list [tasks]="tasks" emptyText="" />
            </section>
          }
        }
      </div>
    }
  `,
})
export class DeadlinesComponent {
  protected readonly store = inject(BoardStore);
  protected readonly urgent = urgentGroups;
  protected readonly nextUrgency = computed(() => this.urgent.find(group => this.store.deadlines()[group.id].length));
  protected readonly groups = [
    ...urgentGroups,
    { id: 'upcoming', title: 'Upcoming' },
    { id: 'undated', title: 'No due date' },
  ] as const;
}
