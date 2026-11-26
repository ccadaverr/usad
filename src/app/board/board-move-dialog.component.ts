import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { closeDialog } from '../shared/close-dialog';
import { IconComponent } from '../shared/icon.component';
import { STATUSES, STATUS_LABELS, Task, TaskStatus } from './board.models';
import { BoardStore } from './board.store';

export interface BoardMoveDialogData {
  taskId: string;
  title: string;
}

@Component({
  selector: 'app-board-move-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-move-dialog.component.html',
})
export class BoardMoveDialogComponent {
  protected readonly store = inject(BoardStore);
  private readonly data = inject<BoardMoveDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly injector = inject(Injector);
  private readonly destroy = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly reloadButton = viewChild<ElementRef<HTMLButtonElement>>('reloadButton');
  protected readonly task = computed<Task | undefined>(() => this.store.tasks()[this.data.taskId]);
  protected readonly title = computed(() => this.task()?.title ?? this.data.title);
  protected readonly statuses = STATUSES;
  protected readonly labels = STATUS_LABELS;
  protected readonly destination = signal<TaskStatus | null>(null);
  protected readonly canChoose = computed(() => !!this.task() && !this.destination() && this.store.canWrite());
  private closing = false;

  dismiss(): void {
    if (!this.destination()) this.finish();
  }

  protected async move(status: TaskStatus): Promise<void> {
    if (this.closing || !this.canChoose() || this.task()?.status === status) return;
    this.destination.set(status);
    const confirmed = await this.store.move(this.data.taskId, status);
    if (this.destroy.destroyed) return;
    if (confirmed) {
      this.finish(true);
    } else {
      this.destination.set(null);
      afterNextRender(() => {
        (this.reloadButton()?.nativeElement ?? this.heading().nativeElement).focus();
      }, { injector: this.injector });
    }
  }

  protected reload(): void {
    if (this.store.loading() || this.closing) return;
    this.heading().nativeElement.focus({ preventScroll: true });
    this.store.load();
  }

  private finish(confirmed?: boolean): void {
    if (this.closing) return;
    this.closing = true;
    closeDialog(this.ref, confirmed);
  }
}
