import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, NgZone, afterNextRender, inject, input, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { fromEvent, takeUntil } from 'rxjs';
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
          <button type="button" aria-haspopup="dialog" (click)="openExport()"><app-icon name="download" />Export my data</button>
          <button type="button" class="guest-start-action" (click)="confirm()"><app-icon name="guest" />Start another guest</button>
        </div>
      }
    }
    @if (!fromWelcome()) {
      <dialog #exportDialog class="appearance-dialog guest-confirm" aria-labelledby="guest-export-title"
        aria-describedby="guest-export-copy" (close)="restoreFocus()">
        <h2 #exportHeading id="guest-export-title" tabindex="-1">Export my data</h2>
        <div id="guest-export-copy" class="guest-export-copy">
          <p>Download a personal copy of your tasks and garden progress. The JSON file may contain private coursework. Keep it somewhere safe.</p>
          <p>Restoring a backup in USAD is coming in a future update.</p>
        </div>
        <p role="status" class="guest-export-status" [class.error-text]="exportState() === 'failed'">{{ exportMessage() }}</p>
        <form method="dialog" class="guest-confirm-actions guest-export-actions">
          <button class="btn button button-primary" type="button" [attr.aria-disabled]="exportState() === 'pending' ? 'true' : null"
            (click)="downloadWorkspace()">{{ exportState() === 'failed' ? 'Try again' : 'Download backup' }}</button>
          <button class="btn btn-outline button button-secondary" type="submit">Close</button>
        </form>
      </dialog>
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
  protected readonly exportState = signal<'idle' | 'pending' | 'started' | 'failed'>('idle');
  protected readonly exportMessage = signal('');
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly exportDialog = viewChild<ElementRef<HTMLDialogElement>>('exportDialog');
  private readonly exportHeading = viewChild<ElementRef<HTMLElement>>('exportHeading');
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

  protected openExport(): void {
    this.exportState.set('idle');
    this.exportMessage.set('');
    this.menu()?.nativeElement.hidePopover();
    this.exportDialog()?.nativeElement.showModal();
    this.exportHeading()?.nativeElement.focus({ preventScroll: true });
  }

  protected downloadWorkspace(): void {
    const dialog = this.exportDialog()?.nativeElement;
    if (!dialog?.open || this.exportState() === 'pending') return;
    this.exportState.set('pending');
    this.exportMessage.set('Preparing your download…');
    this.session.exportWorkspace().pipe(
      takeUntil(fromEvent(dialog, 'close')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => {
        if (!dialog.open) return;
        try {
          this.startDownload(response);
          this.exportState.set('started');
          this.exportMessage.set('Download started. Check your downloads for the backup.');
        } catch {
          this.exportFailed();
        }
      },
      error: failure => this.exportFailed(failure),
    });
  }

  private exportFailed(failure?: unknown): void {
    this.exportState.set('failed');
    this.exportMessage.set(failure instanceof HttpErrorResponse && failure.status === 401
      ? 'Your guest session is missing or expired. Reload USAD to check your session.'
      : 'We couldn’t download your backup. Please try again.');
  }

  private startDownload({ body, headers }: HttpResponse<Blob>): void {
    const type = headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    const filename = /^attachment; filename="(usad-workspace-\d{4}-\d{2}-\d{2}\.json)"$/.exec(headers.get('Content-Disposition') ?? '')?.[1];
    if (type !== 'application/json' || !filename || !body?.size) throw new Error('Invalid workspace backup response.');
    const link = this.document.createElement('a');
    const url = URL.createObjectURL(body);
    link.href = url;
    link.download = filename;
    link.hidden = true;
    try {
      this.document.body.append(link);
      link.click();
    } finally {
      link.remove();
      // Give the browser time to consume the URL, including on slow devices.
      this.zone.runOutsideAngular(() => setTimeout(() => URL.revokeObjectURL(url), 60_000));
    }
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
