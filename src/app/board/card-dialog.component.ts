import { DatePipe, DOCUMENT } from '@angular/common';
import { closeDialog } from '../shared/close-dialog';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { createId, isValidDeadline, localDate, todayISO } from './board.logic';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, Task, TaskStatus } from './board.models';
import { BoardStore } from './board.store';

export interface CardDialogData {
  task?: Task;
  status: TaskStatus;
  confirmDelete?: () => Promise<boolean>;
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
  imports: [DatePipe, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-dialog.component.html',
})
export class CardDialogComponent {
  protected readonly data = inject<CardDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<CardDialogResult>>(DialogRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  protected readonly store = inject(BoardStore);
  protected readonly statuses = STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorities = [...PRIORITIES].reverse();
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly id = this.data.task?.id ?? createId();
  protected readonly calendarDate = localDate;
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [this.data.task?.title ?? '', [requiredText, Validators.maxLength(120)]],
    subject: [this.data.task?.subject ?? '', [requiredText, Validators.maxLength(60)]],
    description: [this.data.task?.description ?? '', Validators.maxLength(1000)],
    priority: [this.data.task?.priority ?? 'medium'],
    status: [this.data.status],
    dueDate: [this.data.task?.dueDate ?? '', deadline],
  });

  protected readonly tomorrow = computed(() => {
    const date = localDate(this.store.today());
    date.setDate(date.getDate() + 1);
    return todayISO(date);
  });

  private readonly initial = this.form.getRawValue();
  protected readonly customDateOpen = signal(
    !!this.initial.dueDate && this.initial.dueDate !== this.store.today() && this.initial.dueDate !== this.tomorrow(),
  );
  protected readonly detailsOpen = signal(!!this.initial.description);
  protected readonly confirmingDiscard = signal(false);
  private previousFocus: HTMLElement | null = null;
  private closing = false;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const form = this.formElement().nativeElement;
      const compact = window.matchMedia('(width < 600px)');
      const adapt = () => {
        if (viewport.scale === 1 && compact.matches) {
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
      compact.addEventListener('change', adapt);
      destroy.onDestroy(() => {
        viewport.removeEventListener('resize', adapt);
        viewport.removeEventListener('scroll', adapt);
        compact.removeEventListener('change', adapt);
      });
    });
  }

  protected setDueDate(value: string): void {
    this.form.controls.dueDate.setValue(value);
    this.customDateOpen.set(false);
  }

  protected revealDate(): void {
    this.customDateOpen.set(true);
    this.afterRender(() => this.dateInput().nativeElement.focus());
  }

  requestDismiss(source: 'control' | 'escape' | 'backdrop' = 'control'): void {
    if (this.closing || this.store.saving()) return;
    if (this.confirmingDiscard()) {
      if (source !== 'backdrop') this.keepEditing();
      return;
    }
    if (!this.hasEditedDraft()) {
      this.finish();
      return;
    }
    if (source === 'backdrop') return;
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    this.confirmingDiscard.set(true);
    this.afterRender(() => this.formElement().nativeElement.querySelector<HTMLElement>('.keep-editing')?.focus());
  }

  protected keepEditing(): void {
    this.confirmingDiscard.set(false);
    this.afterRender(() => {
      const form = this.formElement().nativeElement;
      const target = form.contains(this.previousFocus) ? this.previousFocus : form.querySelector<HTMLElement>('.dialog-cancel');
      target?.focus();
    });
  }

  protected async requestDelete(): Promise<void> {
    if (this.closing || !this.store.canWrite()) return;
    if (await this.data.confirmDelete?.()) this.finish('deleted');
  }

  protected finish(result?: CardDialogResult): void {
    if (this.closing || this.store.saving()) return;
    this.closing = true;
    closeDialog(this.ref, result);
  }

  private hasEditedDraft(): boolean {
    const { title, subject, description, priority, status, dueDate } = this.form.getRawValue();
    return title.trim() !== this.initial.title.trim() || subject.trim() !== this.initial.subject.trim()
      || description.trim() !== this.initial.description.trim() || priority !== this.initial.priority
      || status !== this.initial.status || dueDate !== this.initial.dueDate
      || (this.customDateOpen() && this.dateInput().nativeElement.validity.badInput);
  }

  private afterRender(callback: () => void): void {
    afterNextRender(callback, { injector: this.injector });
  }

  protected async save(): Promise<void> {
    if (this.closing || this.confirmingDiscard() || !this.store.canWrite()) return;
    const { controls } = this.form;
    if (this.customDateOpen() && this.dateInput().nativeElement.validity.badInput) {
      controls.dueDate.setErrors({ deadline: true });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (controls.dueDate.invalid) this.customDateOpen.set(true);
      if (controls.description.invalid) this.detailsOpen.set(true);
      this.afterRender(() => this.formElement().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    const values = this.form.getRawValue();
    const saved = await this.store.save(this.id, {
      ...values,
      title: values.title.trim(),
      subject: values.subject.trim(),
      description: values.description.trim(),
      dueDate: values.dueDate || null,
    }, !!this.data.task);
    if (saved) {
      this.finish('saved');
    } else if (this.store.error()) {
      this.afterRender(() => this.formElement().nativeElement.querySelector<HTMLElement>('.dialog-reload')?.focus());
    }
  }
}
