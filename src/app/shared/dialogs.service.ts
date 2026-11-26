import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardDialogComponent, CardDialogData, CardDialogResult } from '../board/card-dialog.component';
import { BoardMoveDialogComponent, BoardMoveDialogData } from '../board/board-move-dialog.component';
import { Task, TaskStatus } from '../board/board.models';
import { BoardStore } from '../board/board.store';
import { ConfirmData, ConfirmDialogComponent } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogsService {
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
      const result = await this.editTask({
        task,
        status: task?.status ?? status,
        confirmDelete: task ? () => this.confirmDelete(task) : undefined,
      });
      if (result === 'deleted' && task) {
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

  async openMove(taskId: string, trigger: HTMLButtonElement): Promise<void> {
    const task = this.store.tasks()[taskId];
    if (this.open || !task || !this.store.canWrite()) return;
    this.open = true;
    try {
      const ref = this.dialog.open<boolean, BoardMoveDialogData, BoardMoveDialogComponent>(BoardMoveDialogComponent, {
        data: { taskId, title: task.title },
        injector: this.injector,
        ariaLabelledBy: 'move-dialog-title',
        ariaDescribedBy: 'move-dialog-task',
        ariaModal: true,
        autoFocus: '#move-dialog-title',
        restoreFocus: false,
        disableClose: true,
        panelClass: ['task-dialog-panel', 'move-dialog-panel'],
        backdropClass: ['cdk-overlay-dark-backdrop', 'task-dialog-backdrop'],
      });
      this.handleDismissal(ref, () => ref.componentInstance?.dismiss());
      const moved = await firstValueFrom(ref.closed);
      requestAnimationFrame(() => this.restoreMoveFocus(taskId, moved ? null : trigger));
    } finally {
      this.open = false;
    }
  }

  private restoreMoveFocus(taskId: string, trigger: HTMLButtonElement | null): void {
    if (this.document.activeElement !== this.document.body) return;
    const moved = this.document.querySelector<HTMLButtonElement>(
      `.board-card[data-task-id="${CSS.escape(taskId)}"] .move-control`,
    );
    const stage = this.document.querySelector<HTMLButtonElement>('.status-switcher [aria-pressed="true"]');
    for (const target of [trigger, moved, stage, this.document.getElementById('task-search'), this.document.getElementById('content')]) {
      if (!target?.getClientRects().length) continue;
      target.focus({ preventScroll: !!trigger || target !== moved });
      if (this.document.activeElement === target) return;
    }
  }

  private editTask(data: CardDialogData): Promise<CardDialogResult | undefined> {
    const ref = this.dialog.open<CardDialogResult, CardDialogData, CardDialogComponent>(CardDialogComponent, {
      data,
      injector: this.injector,
      ariaLabelledBy: 'task-dialog-title',
      ariaDescribedBy: 'task-dialog-description',
      ariaModal: true,
      disableClose: true,
      autoFocus: matchMedia('(pointer: coarse)').matches ? '#task-dialog-title' : '#task-title',
      panelClass: 'task-dialog-panel',
      backdropClass: ['cdk-overlay-dark-backdrop', 'task-dialog-backdrop'],
    });
    const composer = ref.componentInstance!;
    this.handleDismissal(ref, source => composer.requestDismiss(source));
    return firstValueFrom(ref.closed);
  }

  private handleDismissal<T, C>(ref: DialogRef<T, C>, dismiss: (source: 'backdrop' | 'escape') => void): void {
    ref.backdropClick.subscribe(() => dismiss('backdrop'));
    ref.keydownEvents.subscribe(event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      dismiss('escape');
    });
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
