// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AdminSalasComponent } from './components/admin-salas/admin-salas';

export const routes: Routes = [
  { path: 'admin-salas', component: AdminSalasComponent },
  { path: '', redirectTo: '/admin-salas', pathMatch: 'full' },
  { path: '**', redirectTo: '/admin-salas' } // ruta comodín para cualquier otra URL
];