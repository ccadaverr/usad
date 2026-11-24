import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { PRIORITIES, PRIORITY_LABELS, TaskStatus } from './board.models';
import { BoardStore } from './board.store';
import { ColumnComponent } from './column.component';

@Component({
  selector: 'app-board',
  imports: [CdkDropListGroup, ColumnComponent, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.component.html',
})
export class BoardComponent {
  protected readonly store = inject(BoardStore);
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly selectedStatus = signal<TaskStatus>('pending');
  protected readonly fullBoard = signal(false);
  protected query = this.store.filter().query;

  protected clearFilters(): void {
    this.query = '';
    this.store.clearFilter();
  }
}
