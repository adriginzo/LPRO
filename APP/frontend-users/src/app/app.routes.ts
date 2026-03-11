// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthComponent } from './pages/auth/auth';
import { UserAreaComponent } from './pages/user-area/user-area';
import { AuthGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: AuthComponent },
  { path: 'register', component: AuthComponent },
  { path: 'user-area', component: UserAreaComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'login' },
];