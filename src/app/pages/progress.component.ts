import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STATUSES, STATUS_LABELS } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { IconComponent } from '../shared/icon.component';
import { TaskListComponent } from './task-list.component';

@Component({
  selector: 'app-progress',
  imports: [ RouterLink, IconComponent, TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let stats = store.stats();
    <div class="page-intro">
      <h1>Study progress</h1>
      <p>See what you’ve finished and what’s still on your board.</p>
    </div>
    <div class="progress-layout">
      <section class="focus-panel completion-panel" aria-labelledby="completion-heading">
        <h2 id="completion-heading" class="focus-label"><span></span> Task completion</h2>
        <p class="completion-figure">{{ stats.percent }}<span>%</span></p>
        <progress class="progress-meter" [value]="stats.done" [max]="stats.total || 1" aria-label="Task completion"></progress>
        @if (stats.total) {
          <p class="focus-subject">{{ stats.done }} of {{ stats.total }} tasks completed · {{ stats.remaining }} remaining</p>
        } @else {
          <p class="focus-subject">Your progress will appear here when you add a task.</p>
        }
      </section>
      <section class="progress-distribution distribution" aria-labelledby="distribution-heading">
        <div class="summary-heading">
          <h2 id="distribution-heading">By status</h2>
          <a class="text-link" routerLink="/board" aria-label="Open the task board"><app-icon name="arrow" /></a>
        </div>
        @for (status of statuses; track status) {
          @let count = store.columns()[status].length;
          <div class="distribution-row">
            <div><span class="status-dot" [attr.data-status]="status" aria-hidden="true"></span>{{ labels[status] }} <strong>{{ count }}</strong></div>
            <progress class="progress-meter" [attr.data-status]="status" [value]="count" [max]="stats.total || 1" [attr.aria-label]="labels[status] + ' tasks'"></progress>
          </div>
        }
        <p class="progress-overdue"><strong>{{ store.deadlines().overdue.length }}</strong> overdue</p>
      </section>
    </div>
    <a class="garden-link text-link" routerLink="/garden">
      <span><strong>Munting Tanim</strong><small>See what your completed tasks have grown.</small></span>
      <app-icon name="arrow" />
    </a>
    <section class="list-panel completed-panel" aria-labelledby="completed-heading">
      <div class="list-heading"><h2 id="completed-heading">Completed work</h2><span>{{ stats.done }}</span></div>
      <app-task-list [tasks]="store.columns().completed" emptyText="Completed tasks will appear here." />
    </section>
  `,
})
export class ProgressComponent {
  protected readonly store = inject(BoardStore);
  protected readonly statuses = STATUSES;
  protected readonly labels = STATUS_LABELS;
}
