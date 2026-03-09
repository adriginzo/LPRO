import { Routes } from '@angular/router';
import { LibrarianMonitorComponent } from './pages/librarian-monitor/librarian-monitor';

export const routes: Routes = [
  { path: '', component: LibrarianMonitorComponent },
  { path: '**', redirectTo: '' },
];