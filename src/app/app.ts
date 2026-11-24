import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { BoardStore } from './board/board.store';
import { CompletionMotion } from './shared/completion-motion';
import { UsadBloomComponent } from './shared/usad-bloom.component';
import { DialogsService } from './shared/dialogs.service';
import { IconComponent, IconName } from './shared/icon.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, UsadBloomComponent],
  providers: [CompletionMotion],
  host: { '(document:pointerdown)': 'motion.remember($event.target)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly store = inject(BoardStore);
  protected readonly motion = inject(CompletionMotion);
  protected readonly dialogs = inject(DialogsService);
  protected readonly pageTitle = signal('Home');
  protected readonly links: { path: string; name: string; icon: IconName; accessibleName?: string }[] = [
    { path: '/', name: 'Home', icon: 'home' },
    { path: '/board', name: 'Board', icon: 'board' },
    { path: '/deadlines', name: 'Deadlines', icon: 'calendar' },
    { path: '/progress', name: 'Progress', icon: 'progress' },
    { path: '/garden', name: 'Tanim', icon: 'sprout', accessibleName: 'Munting Tanim' },
  ];
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    const router = inject(Router);
    const route = inject(ActivatedRoute);
    this.store.completionEvents().pipe(takeUntilDestroyed()).subscribe(({ taskId }) => {
      this.motion.play(taskId, this.store.tasks()[taskId]?.title ?? '');
    });
    effect(() => {
      if (!this.store.completion()) this.motion.clearVisual();
    });
    let initialNavigation = true;
    router.events.pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.motion.reset();
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
