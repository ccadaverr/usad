import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { EntryBrandComponent } from './entry-brand.component';
import { GuestActionsComponent } from './guest-actions.component';
import { GuestProfile, GuestSession, workspaceDestination } from './guest-session.service';

@Component({
  selector: 'app-welcome',
  imports: [EntryBrandComponent, GuestActionsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  protected readonly session = inject(GuestSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly nameField = viewChild<ElementRef<HTMLInputElement>>('nameField');
  protected readonly name = signal('');
  protected readonly issue = signal('');
  protected readonly requestError = signal('');
  protected readonly busy = signal(false);
  protected readonly expired = this.route.snapshot.queryParamMap.has('expired');

  constructor() {
    if (this.session.status() === 'checking') void this.session.ensure();
  }

  protected async continue(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const name = this.name().trim().normalize('NFC').replace(/ {2,}/g, ' ');
    if ([...name].length > 32 || !/^\p{L}[\p{L}\p{M}]*(?:[ .'’ʼ·‐‑-]\p{L}[\p{L}\p{M}]*)*\.?$/u.test(name)) {
      this.issue.set(name ? 'Use up to 32 letters and name punctuation.' : 'Enter the name you’d like us to use.');
      this.nameField()?.nativeElement.focus();
      return;
    }
    this.busy.set(true);
    this.requestError.set('');
    try {
      const profile = await this.session.create(name);
      await this.enter(profile);
    } catch (failure) {
      this.requestError.set(failure instanceof HttpErrorResponse && typeof failure.error?.message === 'string'
        ? failure.error.message : 'We could not confirm your workspace. Check that cookies are enabled, then try again.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async enter(profile: GuestProfile): Promise<boolean> {
    const destination = workspaceDestination(this.route.snapshot.queryParamMap.get('returnTo'));
    return profile.onboardingComplete
      ? this.router.navigateByUrl(destination)
      : this.router.navigate(['/onboarding'], { queryParams: { returnTo: destination } });
  }
}
