import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, input, signal, viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { GuestSession } from './guest-session.service';

@Component({
  selector: 'app-guest-actions',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.profile(); as guest) {
      @if (fromWelcome()) {
        <button #trigger type="button" class="btn btn-outline button button-secondary guest-switch-action"
          aria-haspopup="dialog" (click)="confirm()">Start another guest</button>
      } @else {
        <button #trigger type="button" class="btn button guest-menu-trigger" aria-label="Guest workspace"
          popovertarget="guest-actions"><app-icon name="guest" /><app-icon class="guest-menu-chevron" name="chevron" /></button>
        <div #menu class="guest-menu" id="guest-actions" popover aria-label="Guest workspace" role="group">
          <p class="guest-menu-name"><small>Guest workspace</small><strong><bdi>{{ guest.displayName }}</bdi></strong></p>
          <a routerLink="/" autofocus><app-icon name="home" />Welcome</a>
          <a routerLink="/home" (click)="menu.hidePopover()"><app-icon name="arrow" />Continue as <bdi>{{ guest.displayName }}</bdi></a>
          <button type="button" (click)="confirm()"><app-icon name="guest" />Start another guest</button>
        </div>
      }
    }
    <dialog #dialog class="appearance-dialog guest-confirm" aria-labelledby="guest-confirm-title"
      aria-describedby="guest-confirm-copy" (cancel)="cancel($event)" (close)="restoreFocus()">
      <h2 #heading id="guest-confirm-title" tabindex="-1">Start a fresh workspace?</h2>
      <p id="guest-confirm-copy">Your current work will stay saved. Ending this browser’s guest session may make your workspace impossible to recover, even if you enter the same name again.</p>
      @if (error()) { <p class="error-text" role="alert">{{ error() }}</p> }
      <span class="sr-only" aria-live="polite">{{ busy() ? 'Ending session…' : '' }}</span>
      <form method="dialog" class="confirm-actions guest-confirm-actions" [attr.aria-busy]="busy()">
        <button class="btn button button-primary" type="submit" [disabled]="busy()" autofocus>Keep my workspace</button>
        <button #confirmAction class="btn btn-outline button button-secondary" type="button" [disabled]="busy()" (click)="leave()">
          {{ busy() ? 'Ending session…' : error() ? 'Retry' : 'Start fresh' }}
        </button>
      </form>
    </dialog>
  `,
})
export class GuestActionsComponent {
  readonly fromWelcome = input(false);
  protected readonly session = inject(GuestSession);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly confirmAction = viewChild.required<ElementRef<HTMLButtonElement>>('confirmAction');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected confirm(): void {
    this.error.set('');
    this.menu()?.nativeElement.hidePopover();
    this.dialog().nativeElement.showModal();
  }

  protected cancel(event: Event): void {
    if (this.busy()) event.preventDefault();
  }

  protected restoreFocus(): void {
    this.trigger()?.nativeElement.focus({ preventScroll: true });
  }

  protected async leave(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.heading().nativeElement.focus({ preventScroll: true });
    try {
      await this.session.leave();
    } catch (failure) {
      const hint = this.session.localApiHint(failure);
      this.error.set('We couldn’t confirm that your session ended. ' + (hint || 'Please try again.'));
      this.busy.set(false);
      afterNextRender(() => this.confirmAction().nativeElement.focus({ preventScroll: true }), { injector: this.injector });
      return;
    }
    this.dialog().nativeElement.close();
    this.busy.set(false);
    if (this.router.url !== '/') await this.router.navigateByUrl('/', { replaceUrl: true });
    if (this.fromWelcome()) {
      afterNextRender(() => this.document.querySelector<HTMLInputElement>('#guest-name')?.focus({ preventScroll: true }),
        { injector: this.injector });
    }
  }
}
