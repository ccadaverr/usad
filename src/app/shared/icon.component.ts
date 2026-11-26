import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName = 'home' | 'board' | 'calendar' | 'progress' | 'plus' | 'arrow' | 'search' | 'grip' | 'close' | 'check' | 'warning' | 'chevron' | 'list' | 'sprout' | 'appearance' | 'filter' | 'edit' | 'guest' | 'drop';
export type NavigationIconName = 'kubo' | 'banig' | 'nav-calendar' | 'nav-progress' | 'nav-sprout';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('kubo') { <path d="M2.5 12 12 3l9.5 9H2.5Zm3 0v5.5h13V12M7 17.5V21m10-3.5V21m-5.5-3.5L10 21" /> }
        @case ('banig') {
          <rect x="2.8" y="4.4" width="18.4" height="15.2" rx="2" />
          <path d="M9 4.4v15.2m6-15.2v15.2M5 8.5h1.8M5 12.5h1.8m4.3-2h1.8m-1.8 4h1.8m4.3-2h1.8" />
        }
        @case ('nav-calendar') { <rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7.5 3.5v4m9-4v4m-13 3h17m-12 5h2m3 0h2" /> }
        @case ('nav-progress') { <path d="M4 4v16h16M8.5 16v-3.5m4.5 3.5v-7m4.5 7V5" /> }
        @case ('nav-sprout') { <path d="M7.5 20.5h9m-4.5 0v-7m0 2C7 15.5 4 12.5 4 8c4.5 0 8 3 8 7.5Zm0-2C12 8 15 4.5 20 4c0 5-3 9-8 9.5Z" /> }
        @case ('appearance') { <circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 1 1 0 17Z" fill="currentColor" stroke="none" /> }
        @case ('home') { <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 21v-7h6v7" /> }
        @case ('board') { <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m6-16v16" /> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2" /> }
        @case ('progress') { <path d="M3 4v16h18M8 16v-3m5 3V9m5 7V5" /> }
        @case ('sprout') { <path d="M7 21h10m-5 0v-7m0 2c0-5-3-8-8-8 0 5 3 8 8 8Zm0-3c0-5 3-9 8-9 0 5-3 9-8 9Z" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('arrow') { <path d="M4 12h15m-6-6 6 6-6 6" /> }
        @case ('search') { <circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4.5 4.5" /> }
        @case ('filter') { <path d="M4 7h9m4 0h3M4 17h3m4 0h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /> }
        @case ('guest') { <circle cx="12" cy="8" r="3.1" /><path d="M5.5 20v-1.4a6.5 6.5 0 0 1 13 0V20" /> }
        @case ('drop') { <path d="M12 3C10.2 6 6.5 10 6.5 13.7a5.5 5.5 0 0 0 11 0C17.5 10 13.8 6 12 3Z" /><path d="M9.5 14.5a2.8 2.8 0 0 0 2 2.1" /> }
        @case ('edit') { <path d="M4 20l4.5-1 11-11a2.5 2.5 0 0 0-3.5-3.5l-11 11L4 20zm10-13 3 3" /> }
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
  readonly name = input.required<IconName | NavigationIconName>();
}
