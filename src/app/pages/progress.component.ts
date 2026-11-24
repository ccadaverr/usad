import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STATUSES, STATUS_LABELS } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { IconComponent } from '../shared/icon.component';
import { TaskListComponent } from './task-list.component';

@Component({
  selector: 'app-progress',
  imports: [RouterLink, IconComponent, TaskListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let stats = store.stats();
    <div class="page-intro compact-page-intro">
      <h1>Study progress</h1>
      <p>See what you’ve finished and what’s still on your board.</p>
    </div>

    <div class="progress-layout">
      <section class="completion-panel" aria-labelledby="completion-heading">
        <div class="completion-copy">
          <h2 id="completion-heading">Task completion</h2>
          @if (stats.total) {
            <p class="completion-count">{{ stats.done }} of {{ stats.total }} finished</p>
            <p>{{ stats.remaining ? (stats.done ? 'Every finished task brings you a little further.' : 'Start anywhere. Your first finish counts.') : 'You’ve finished everything on your board.' }}</p>
          } @else {
            <p class="completion-count">Room to grow.</p>
            <p>Your progress will take shape as you finish tasks.</p>
          }
        </div>
        <div class="radial-progress completion-ring" [style.--value]="stats.percent"
          role="progressbar" aria-label="Task completion" [attr.aria-valuenow]="stats.percent">
          <span class="completion-figure">{{ stats.percent }}<span>%</span></span>
        </div>
      </section>

      @if (stats.total) {
        <section class="progress-distribution" aria-labelledby="distribution-heading">
          <div class="summary-heading">
            <h2 id="distribution-heading">By status</h2>
            <a class="text-link" routerLink="/board">Board <app-icon name="arrow" /></a>
          </div>
          @for (status of statuses; track status) {
            @let count = store.columns()[status].length;
            <div class="distribution-row">
              <div><span class="status-dot" [attr.data-status]="status" aria-hidden="true"></span>{{ labels[status] }} <strong>{{ count }}</strong></div>
              <progress class="progress progress-meter" [attr.data-status]="status" [value]="count" [max]="stats.total" [attr.aria-label]="labels[status] + ' tasks'"></progress>
            </div>
          }
        </section>
      }
    </div>

    @if (stats.total) {
      <section class="list-panel completed-panel" aria-labelledby="completed-heading">
        <div class="list-heading"><h2 id="completed-heading">Completed work</h2><span>{{ stats.done }}</span></div>
        <app-task-list [tasks]="store.columns().completed" emptyText="Your finished tasks will appear here." />
      </section>
    }
  `,
})
export class ProgressComponent {
  protected readonly store = inject(BoardStore);
  protected readonly statuses = STATUSES;
  protected readonly labels = STATUS_LABELS;
}
