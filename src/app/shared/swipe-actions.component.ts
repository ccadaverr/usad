import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-swipe-actions',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="swipe-start"><app-icon name="arrow" /><span>{{ saving() ? 'Saving…' : 'Start now' }}</span></span>
    <span class="swipe-complete"><span>{{ saving() ? 'Saving…' : 'Complete' }}</span><app-icon name="check" /></span>
  `,
})
export class SwipeActionsComponent {
  readonly saving = input(false);
}
