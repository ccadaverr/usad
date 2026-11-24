import { Routes } from '@angular/router';
import { BoardComponent } from './board/board.component';
import { DeadlinesComponent } from './pages/deadlines.component';
import { HomeComponent } from './pages/home.component';
import { ProgressComponent } from './pages/progress.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { page: 'Home' }, title: 'Home · USAD' },
  { path: 'board', component: BoardComponent, data: { page: 'Board' }, title: 'Board · USAD' },
  { path: 'deadlines', component: DeadlinesComponent, data: { page: 'Deadlines' }, title: 'Deadlines · USAD' },
  { path: 'progress/garden', pathMatch: 'full', redirectTo: 'garden' },
  { path: 'garden', loadComponent: () => import('./pages/plant.component').then(module => module.PlantComponent),
    data: { page: 'Munting Tanim' }, title: 'Munting Tanim · USAD' },
  { path: 'progress', component: ProgressComponent, data: { page: 'Progress' }, title: 'Progress · USAD' },
  { path: '**', redirectTo: '' },
];
