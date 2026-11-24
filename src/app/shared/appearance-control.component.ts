import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { APPEARANCES, APPEARANCE_MODES, AppearanceService } from './appearance.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-appearance-control',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button #trigger type="button" class="btn button appearance-trigger" aria-label="Appearance" aria-haspopup="dialog" (click)="open()">
      <app-icon name="appearance" /><span>Appearance</span>
    </button>
    <dialog #panel class="appearance-dialog" aria-labelledby="appearance-title" (close)="trigger.focus({ preventScroll: true })">
      <div class="appearance-heading">
        <h2 id="appearance-title">Appearance</h2>
        <button type="button" class="btn button icon-button" aria-label="Close appearance" (click)="panel.close()">
          <app-icon name="close" />
        </button>
      </div>
      <fieldset class="appearance-mode">
        <legend>Mode</legend>
        <div class="appearance-segments">
          @for (mode of modes; track mode) {
            <label>
              <input class="sr-only" type="radio" name="usad-mode" [value]="mode"
                [checked]="appearance.mode() === mode" (change)="appearance.selectMode(mode)" />
              <span>{{ mode }}</span>
            </label>
          }
        </div>
      </fieldset>
      <fieldset class="appearance-options">
        <legend>Palette</legend>
        @for (option of options; track option.id) {
          <label class="appearance-option">
            <input type="radio" name="usad-appearance" [value]="option.id" [attr.aria-label]="option.name"
              [checked]="appearance.selected() === option.id" (change)="appearance.select(option.id)" />
            <span><strong>{{ option.name }}</strong><small>{{ option.description }}</small></span>
            <span class="appearance-swatches" [attr.data-theme]="option.id" aria-hidden="true"><i></i><i></i><i></i></span>
          </label>
        }
      </fieldset>
    </dialog>
  `,
})
export class AppearanceControlComponent {
  protected readonly appearance = inject(AppearanceService);
  protected readonly options = APPEARANCES;
  protected readonly modes = APPEARANCE_MODES;
  private readonly panel = viewChild.required<ElementRef<HTMLDialogElement>>('panel');

  protected open(): void {
    const dialog = this.panel().nativeElement;
    if (dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.icon-button')?.focus({ preventScroll: true });
  }
}
