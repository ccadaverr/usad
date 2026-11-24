import { Overlay } from '@angular/cdk/overlay';
import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardDialogComponent, CardDialogData, CardDialogResult } from '../board/card-dialog.component';
import { Task, TaskStatus } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { ConfirmData, ConfirmDialogComponent } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogsService {
  private readonly overlay = inject(Overlay);
  private readonly dialog = inject(Dialog);
  private readonly store = inject(BoardStore);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private open = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dialog.closeAll());
  }

  async openTask(task?: Task, status: TaskStatus = 'pending'): Promise<void> {
    if (this.open || (!task && !this.store.canWrite())) return;
    this.open = true;
    try {
      const result = await this.editTask({ task, status: task?.status ?? status });
      if (result === 'deleted' && task && await this.confirmDelete(task)) {
        await this.store.remove(task.id);
      }
    } finally {
      this.open = false;
      // A status change or deletion can remove the element that originally had focus.
      if (this.document.activeElement === this.document.body) {
        this.document.querySelector<HTMLElement>('#content')?.focus({ preventScroll: true });
      }
    }
  }

  private editTask(data: CardDialogData): Promise<CardDialogResult | undefined> {
    const ref = this.dialog.open<CardDialogResult, CardDialogData>(CardDialogComponent, {
      data,
      injector: this.injector,
      ariaLabelledBy: 'task-dialog-title',
      ariaModal: true,
      autoFocus: matchMedia('(pointer: coarse)').matches ? 'first-header' : '#task-title',
      positionStrategy: matchMedia('(max-width: 599px)').matches
        ? this.overlay.position().global().centerHorizontally().bottom()
        : undefined,
      panelClass: 'task-dialog-panel',
    });
    return firstValueFrom(ref.closed);
  }

  private async confirmDelete(task: Task): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmData>(ConfirmDialogComponent, {
      data: { title: task.title },
      role: 'alertdialog',
      ariaLabelledBy: 'confirm-title',
      ariaDescribedBy: 'confirm-description',
      ariaModal: true,
      panelClass: 'confirm-dialog-panel',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
