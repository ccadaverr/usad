import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { localDate } from '../board/board.logic';
import { Task } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { DialogsService } from '../shared/dialogs.service';
import { IconComponent } from '../shared/icon.component';
import { TaskListComponent } from './task-list.component';

const groups = [
  { id: 'overdue', title: 'Overdue', urgency: 'overdue' },
  { id: 'today', title: 'Due today', urgency: 'due today' },
  { id: 'tomorrow', title: 'Due tomorrow', urgency: 'due tomorrow' },
  { id: 'upcoming', title: 'Upcoming', urgency: 'coming up' },
  { id: 'undated', title: 'No due date', urgency: '' },
] as const;

@Component({
  selector: 'app-deadlines',
  imports: [DatePipe, IconComponent, TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-intro deadlines-intro">
      <h1>Deadlines</h1>
      <p>See what’s due first and what’s coming up.</p>
    </div>

    @if (store.loaded()) {
      @let deadlines = store.deadlines();
      @let lead = nextUrgency();
      <section class="deadline-brief" aria-label="Deadline summary">
        @if (lead) {
          @let count = deadlines[lead.id].length;
          <div class="deadline-lead" [attr.data-urgency]="lead.id">
            <h2><strong>{{ count }}</strong> {{ count === 1 ? 'task' : 'tasks' }} {{ lead.urgency }}</h2>
            @if (lead.id === 'upcoming') { <p>Nothing due through tomorrow.</p> }
          </div>
          <a class="text-link" [attr.href]="'#deadline-' + lead.id" (click)="jumpTo($event, 'deadline-' + lead.id)">
            View {{ lead.id === 'overdue' ? 'overdue tasks' : 'tasks' }} <app-icon name="arrow" />
          </a>
        } @else {
          <div class="deadline-lead">
            @if (store.stats().remaining) {
              <h2>No dated tasks</h2>
              <p>Your open tasks are listed below.</p>
            } @else if (store.stats().total) {
              <h2>All caught up</h2>
              <p>You’ve finished your open tasks.</p>
            } @else {
              <h2>No deadlines yet</h2>
              <p>Add a task with a due date to see it here.</p>
            }
          </div>
          @if (!store.stats().total) {
            <button class="btn button button-primary" type="button" [disabled]="!store.canWrite()" (click)="dialogs.openTask()">
              Add a task
            </button>
          }
        }
      </section>

      <div class="deadline-groups">
        @for (group of groups; track group.id) {
          @let tasks = deadlines[group.id];
          @if (tasks.length) {
            <section class="deadline-section" [attr.data-deadline-group]="group.id" [attr.aria-labelledby]="'deadline-' + group.id">
              <header class="deadline-section-heading">
                <h2 [id]="'deadline-' + group.id" tabindex="-1">{{ group.title }}</h2>
                @if (group.id === 'today' || group.id === 'tomorrow') {
                  @if (tasks[0].dueDate; as due) {
                    <time [attr.datetime]="due">{{ date(due) | date:'EEE, MMM d' }}</time>
                  }
                }
                <span>{{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }}</span>
              </header>
              @if (group.id === 'upcoming') {
                @for (day of upcomingDays(); track day.date) {
                  <div class="deadline-day">
                    <h3><time [attr.datetime]="day.date">{{ date(day.date) | date:'EEE, MMM d, y' }}</time></h3>
                    <app-task-list [tasks]="day.tasks" emptyText="" deadlineGroup="upcoming" [showStart]="false" />
                  </div>
                }
              } @else {
                <app-task-list [tasks]="tasks" emptyText="" [deadlineGroup]="group.id" [showStart]="false" />
              }
            </section>
          }
        }
      </div>
    } @else if (store.loading()) {
      <p role="status" class="muted">Loading deadlines…</p>
    }
  `,
})
export class DeadlinesComponent {
  protected readonly store = inject(BoardStore);
  protected readonly dialogs = inject(DialogsService);
  protected readonly date = localDate;
  protected readonly groups = groups;
  protected readonly nextUrgency = computed(() =>
    this.groups.find(group => group.urgency && this.store.deadlines()[group.id].length),
  );
  protected readonly upcomingDays = computed(() => {
    const days = new Map<string, Task[]>();
    for (const task of this.store.deadlines().upcoming) {
      if (!task.dueDate) continue;
      const tasks = days.get(task.dueDate);
      if (tasks) tasks.push(task);
      else days.set(task.dueDate, [task]);
    }
    return Array.from(days, ([date, tasks]) => ({ date, tasks }));
  });

  protected jumpTo(event: MouseEvent, id: string): void {
    const link = event.currentTarget as HTMLAnchorElement;
    const heading = link.ownerDocument.getElementById(id);
    if (!heading || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start' });
  }
}
