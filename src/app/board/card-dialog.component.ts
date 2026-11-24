import { DeadlineComponent } from '../shared/deadline.component';
import { closeDialog } from '../shared/close-dialog';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { createId, isValidDeadline, localDate, todayISO } from './board.logic';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, Task, TaskStatus } from './board.models';
import { BoardStore } from './board.store';

export interface CardDialogData {
  task?: Task;
  status: TaskStatus;
}

export type CardDialogResult = 'deleted' | 'saved';

function requiredText(control: AbstractControl<string>) {
  return control.value.trim() ? null : { required: true };
}

function deadline(control: AbstractControl<string>) {
  return isValidDeadline(control.value) ? null : { deadline: true };
}

@Component({
  selector: 'app-card-dialog',
  imports: [DeadlineComponent, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-dialog.component.html',
})
export class CardDialogComponent {
  protected readonly dismiss = closeDialog;
  protected readonly data = inject<CardDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CardDialogResult>>(DialogRef);
  protected readonly store = inject(BoardStore);
  protected readonly statuses = STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorities = [...PRIORITIES].reverse();
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly id = this.data.task?.id ?? createId();
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [this.data.task?.title ?? '', [requiredText, Validators.maxLength(120)]],
    subject: [this.data.task?.subject ?? '', [requiredText, Validators.maxLength(60)]],
    description: [this.data.task?.description ?? '', Validators.maxLength(1000)],
    priority: [this.data.task?.priority ?? 'medium'],
    status: [this.data.task?.status ?? ('pending' as TaskStatus)],
    dueDate: [this.data.task?.dueDate ?? '', deadline],
  });

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const form = this.formElement().nativeElement;
      const adapt = () => {
        const keyboardInsets = viewport.scale === 1 && window.innerWidth < 600;
        if (keyboardInsets) {
          form.style.setProperty('--composer-height', `${viewport.height}px`);
          form.style.setProperty('--composer-lift', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
        } else {
          form.style.removeProperty('--composer-height');
          form.style.removeProperty('--composer-lift');
        }
      };
      adapt();
      viewport.addEventListener('resize', adapt);
      viewport.addEventListener('scroll', adapt);
      destroy.onDestroy(() => {
        viewport.removeEventListener('resize', adapt);
        viewport.removeEventListener('scroll', adapt);
      });
    });
  }

  protected readonly tomorrow = computed(() => {
    const date = localDate(this.store.today());
    date.setDate(date.getDate() + 1);
    return todayISO(date);
  });

  protected chooseDate(offset: number): void {
    const field = this.form.controls.dueDate;
    field.setValue(offset ? this.tomorrow() : this.store.today());
    field.markAsDirty();
  }

  protected pickDate(input: HTMLInputElement): void {
    input.focus();
    try { input.showPicker?.(); } catch { /* The focused native field is available on restricted browsers. */ }
  }

  protected async save(): Promise<void> {
    if (this.ref.disableClose || !this.store.canWrite()) return;
    const { controls } = this.form;
    if (this.dateInput().nativeElement.validity.badInput) controls.dueDate.setErrors({ deadline: true });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formElement().nativeElement.querySelector<HTMLElement>('.ng-invalid')?.focus();
      return;
    }

    const values = this.form.getRawValue();
    this.ref.disableClose = true;
    const saved = await this.store.save(this.id, {
      ...values,
      title: values.title.trim(),
      subject: values.subject.trim(),
      description: values.description.trim(),
      dueDate: values.dueDate || null,
    }, !!this.data.task);
    this.ref.disableClose = false;
    if (saved) closeDialog(this.ref, 'saved');
  }
}
