import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AppearanceControlComponent } from './shared/appearance-control.component';
import { BoardStore } from './board/board.store';
import { CompletionMotion } from './shared/completion-motion';
import { UsadBloomComponent } from './shared/usad-bloom.component';
import { DialogsService } from './shared/dialogs.service';
import { IconComponent, NavigationIconName } from './shared/icon.component';
import { GuestActionsComponent } from './guest/guest-actions.component';
import { GardenService } from './pages/garden.service';
import { HOME_PREVIEW, HOME_REVEAL, HomeComponent } from './pages/home.component';

@Component({
  selector: 'app-workspace',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, UsadBloomComponent, AppearanceControlComponent, GuestActionsComponent, HomeComponent],
  providers: [BoardStore, DialogsService, CompletionMotion, GardenService],
  host: { '(document:pointerdown)': 'motion?.remember($event.target)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace.component.html',
})
export class WorkspaceComponent {
  protected readonly preview = inject(HOME_PREVIEW, { optional: true });
  protected readonly store = this.preview ? null : inject(BoardStore);
  protected readonly motion = this.preview ? null : inject(CompletionMotion);
  protected readonly dialogs = this.preview ? null : inject(DialogsService);
  private readonly router = inject(Router);
  protected readonly arrivingHome = this.router.currentNavigation()?.extras.info === HOME_REVEAL;
  protected readonly pageTitle = signal('Home');
  protected readonly links: { path: string; name: string; icon: NavigationIconName; accessibleName?: string }[] = [
    { path: '/home', name: 'Home', icon: 'kubo' },
    { path: '/board', name: 'Board', icon: 'banig' },
    { path: '/deadlines', name: 'Deadlines', icon: 'nav-calendar' },
    { path: '/progress', name: 'Progress', icon: 'nav-progress' },
    { path: '/garden', name: 'Tanim', icon: 'nav-sprout', accessibleName: 'Munting Tanim' },
  ];
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    const { store, motion } = this;
    if (!store || !motion) return;
    const route = inject(ActivatedRoute);
    store.completionEvents().pipe(takeUntilDestroyed()).subscribe(({ taskId, earnedWater }) => {
      if (earnedWater) motion.play(taskId, store.tasks()[taskId]?.title ?? '');
    });
    effect(() => {
      if (!store.completion()) motion.clearVisual();
    });
    let initialNavigation = true;
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      motion.reset();
      this.pageTitle.set(route.firstChild?.snapshot.data['page'] ?? 'Home');
      if (!initialNavigation) this.main().nativeElement.focus({ preventScroll: true });
      initialNavigation = false;
    });
  }

  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}
