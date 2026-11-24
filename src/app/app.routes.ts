import { Routes } from '@angular/router';
import { requireGuest } from './guest/guest.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Welcome · USAD',
    loadComponent: () => import('./guest/welcome.component').then(module => module.WelcomeComponent) },
  { path: 'onboarding', canActivate: [requireGuest], title: 'A short tour · USAD',
    loadComponent: () => import('./guest/onboarding.component').then(module => module.OnboardingComponent) },
  { path: 'progress/garden', pathMatch: 'full', redirectTo: 'garden' },
  { path: '', loadChildren: () => import('./workspace.routes').then(module => module.workspaceRoutes) },
  { path: '**', redirectTo: '' },
];
