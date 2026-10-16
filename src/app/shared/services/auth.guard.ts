import { inject } from '@angular/core';
import { AuthService } from './auth';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitUntilReady();

  if (authService.currentUserId()) {
    return true;
  }

  router.navigateByUrl('/login');
  return false;
};
