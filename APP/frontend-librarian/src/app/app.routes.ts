import { Routes } from '@angular/router';
import { LibrarianMonitorComponent } from './pages/librarian-monitor/librarian-monitor';
import { LibrarianAuthComponent } from './pages/librarian-auth/librarian-auth';
import { librarianAuthGuard } from './guards/librarian-auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: LibrarianAuthComponent
  },
  {
    path: 'login',
    component: LibrarianAuthComponent
  },
  {
    path: 'monitor',
    component: LibrarianMonitorComponent,
    canActivate: [librarianAuthGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];