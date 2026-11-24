import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../shared/icon.component';
import { DialogsService } from '../shared/dialogs.service';
import { PRIORITIES, PRIORITY_LABELS, TaskStatus } from './board.models';
import { BoardStore } from './board.store';
import { ColumnComponent } from './column.component';

@Component({
  selector: 'app-board',
  imports: [CdkDropListGroup, ColumnComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.component.html',
})
export class BoardComponent {
  protected readonly store = inject(BoardStore);
  protected readonly dialogs = inject(DialogsService);
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly selectedStatus = signal<TaskStatus>('pending');
  protected readonly fullBoard = signal(false);
  private readonly stackedBoard = toSignal(inject(BreakpointObserver).observe('(max-width: 959px)'));
  // Align the preview with the stacked lanes while letting CDK scroll the viewport.
  protected readonly dragAxis = computed(() => this.stackedBoard()?.matches ? 'y' : null);
  protected readonly activeFilters = computed(() => {
    const { subject, priority } = this.store.filter();
    return Number(!!subject) + Number(priority !== 'all');
  });
  protected readonly results = computed(() => this.store.view().reduce((total, stage) => total + stage.tasks.length, 0));
}
