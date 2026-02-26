import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { UserAreaComponent } from './pages/user-area/user-area';
import { AuthGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  {
    path: 'user-area',
    component: UserAreaComponent,
    canActivate: [AuthGuard]
  },

  { path: '**', redirectTo: 'login' }
];