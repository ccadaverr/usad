import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName = 'home' | 'board' | 'calendar' | 'progress' | 'plus' | 'arrow' | 'search' | 'grip' | 'close' | 'check' | 'warning' | 'chevron' | 'list' | 'sprout';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('home') { <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 21v-7h6v7" /> }
        @case ('board') { <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m6-16v16" /> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2" /> }
        @case ('progress') { <path d="M3 4v16h18M8 16v-3m5 3V9m5 7V5" /> }
        @case ('sprout') { <path d="M7 21h10m-5 0v-7m0 2c0-5-3-8-8-8 0 5 3 8 8 8Zm0-3c0-5 3-9 8-9 0 5-3 9-8 9Z" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('arrow') { <path d="M4 12h15m-6-6 6 6-6 6" /> }
        @case ('search') { <circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /> }
        @case ('grip') { <path stroke-width="3" d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" /> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18" /> }
        @case ('check') { <path d="m5 12 4 4L19 6" /> }
        @case ('warning') { <path d="M12 8v4m0 4h.01M10.2 4.2 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.8 4.2a2 2 0 0 0-3.6 0Z" /> }
        @case ('chevron') { <path d="m7 10 5 5 5-5" /> }
        @case ('list') { <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /> }
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
