import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppearanceControlComponent } from '../shared/appearance-control.component';

@Component({
  selector: 'app-entry-brand',
  imports: [RouterLink, AppearanceControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="entry-brand">
      <a class="wordmark" routerLink="/">
        <span class="baybayin" aria-hidden="true" lang="tl-Tglg">ᜂᜐᜇ᜔</span>usad<span>.</span><span class="sr-only"> Welcome</span>
      </a>
      <span class="entry-motto" lang="fil"><span>Munting hakbang.</span> <span>Tunay na pag-usad.</span></span>
      <div class="entry-brand-actions"><app-appearance-control /><ng-content /></div>
    </header>
  `,
})
export class EntryBrandComponent {}
