import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GuestSession, workspaceDestination } from './guest-session.service';

export const requireGuest: CanActivateFn = async () => {
  const session = inject(GuestSession);
  const router = inject(Router);
  return await session.ensure() ? true : router.createUrlTree(['/']);
};

export const requireReadyGuest: CanActivateFn = async (_route, state) => {
  const session = inject(GuestSession);
  const router = inject(Router);
  const profile = await session.ensure();
  const returnTo = workspaceDestination(state.url);
  if (!profile) return router.createUrlTree(['/'], { queryParams: { returnTo } });
  if (!profile.onboardingComplete) return router.createUrlTree(['/onboarding'], { queryParams: { returnTo } });
  return true;
};
