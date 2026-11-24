import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, DragAxis } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from '../shared/icon.component';
import { ColumnView, TaskStatus } from './board.models';
import { BoardStore } from './board.store';
import { CardComponent } from './card.component';

@Component({
  selector: 'app-column',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './column.component.html',
})
export class ColumnComponent {
  protected readonly store = inject(BoardStore);
  protected readonly dragDelay = { mouse: 0, touch: 160 };

  readonly column = input.required<ColumnView>();
  readonly dragAxis = input<DragAxis | null>(null);

  protected drop(event: CdkDragDrop<TaskStatus, TaskStatus, string>): void {
    if (!event.isPointerOverContainer) return;
    void this.store.move(event.item.data, event.container.data, event.currentIndex);
  }
}
