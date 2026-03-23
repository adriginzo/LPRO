import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LibrarianAuthService } from '../services/librarian-auth';

export const librarianGuestGuard: CanActivateFn = () => {
  const auth = inject(LibrarianAuthService);
  const router = inject(Router);

  if (auth.isLibrarian()) {
    return router.createUrlTree(['/monitor']);
  }

  return true;
};