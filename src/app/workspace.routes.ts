import { Routes } from '@angular/router';
import { BoardComponent } from './board/board.component';
import { requireReadyGuest } from './guest/guest.guards';
import { DeadlinesComponent } from './pages/deadlines.component';
import { HomeComponent } from './pages/home.component';
import { ProgressComponent } from './pages/progress.component';
import { WorkspaceComponent } from './workspace.component';

export const workspaceRoutes: Routes = [{
  path: '', component: WorkspaceComponent, canActivate: [requireReadyGuest], children: [
    { path: 'home', component: HomeComponent, data: { page: 'Home' }, title: 'Home · USAD' },
    { path: 'board', component: BoardComponent, data: { page: 'Board' }, title: 'Board · USAD' },
    { path: 'deadlines', component: DeadlinesComponent, data: { page: 'Deadlines' }, title: 'Deadlines · USAD' },
    { path: 'garden', loadComponent: () => import('./pages/plant.component').then(module => module.PlantComponent),
      data: { page: 'Munting Tanim' }, title: 'Munting Tanim · USAD' },
    { path: 'progress', component: ProgressComponent, data: { page: 'Progress' }, title: 'Progress · USAD' },
  ],
}];
