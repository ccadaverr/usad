import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-usad-bloom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.bloom-animated]': 'animate()' },
  template: `
    <svg viewBox="0 0 48 48" focusable="false">
      <circle class="bloom-disc" cx="24" cy="24" r="11" />
      <path class="bloom-check" d="m19.5 24 3 3 6-6.5" pathLength="1" />
      <g class="bloom-leaves">
        <path d="M11 16c-5 0-7-3-7-7 4 0 7 2 7 7Z" />
        <path d="M36 16c0-5 3-7 7-8 0 4-3 7-7 8Z" />
        <path d="M36 34c4-1 7 1 9 5-4 1-8-1-9-5Z" />
      </g>
    </svg>
  `,
})
export class UsadBloomComponent {
  readonly animate = input(false);
}
