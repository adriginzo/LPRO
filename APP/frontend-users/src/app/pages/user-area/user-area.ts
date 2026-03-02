// src/app/pages/user-area/user-area.ts
import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { Observable, BehaviorSubject, combineLatest, map, shareReplay } from 'rxjs';
import { FormsModule } from '@angular/forms';

type Sala = {
  _id?: string;
  facultad: string;
  numeroSala: number;
  personasDentro: number;
  ruidoDb: number;
  horaEntrada: string | Date;
  horaSalida?: string | Date;
};

@Component({
  selector: 'app-user-area',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './user-area.html',
  styleUrls: ['./user-area.css'],
})
export class UserAreaComponent {
  // Admin
  isAdmin = false;

  // Users (lo mantengo porque ya lo tenías)
  users$: Observable<any[]>;

  // Salas
  private readonly salasApiUrl = 'http://100.80.240.31:3000/salas';
  salasRaw$: Observable<Sala[]>;
  faculties$: Observable<string[]>;
  salasFiltered$: Observable<Sala[]>;

  // Search UI
  search = '';
  private search$ = new BehaviorSubject<string>('');

  constructor(
    private auth: AuthService,
    private http: HttpClient
  ) {
    this.isAdmin = this.auth.isAdmin();

    // Users (backend users)
    this.users$ = this.http.get<any[]>('http://100.80.240.31:3001/users');

    // Salas (backend salas)
    this.salasRaw$ = this.http.get<Sala[]>(this.salasApiUrl).pipe(
      shareReplay(1)
    );

    // Lista única de “bibliotecas” (facultades)
    this.faculties$ = this.salasRaw$.pipe(
      map((salas) => Array.from(new Set(salas.map(s => (s.facultad || '').trim()))).filter(Boolean).sort()),
      shareReplay(1)
    );

    // Filtrado por búsqueda (facultad o nº sala)
    this.salasFiltered$ = combineLatest([this.salasRaw$, this.search$]).pipe(
      map(([salas, term]) => {
        const t = (term || '').trim().toLowerCase();
        if (!t) return salas;

        return salas.filter((s) => {
          const fac = (s.facultad || '').toLowerCase();
          const num = String(s.numeroSala ?? '').toLowerCase();
          return fac.includes(t) || num.includes(t);
        });
      })
    );
  }

  onSearchChange(value: string) {
    this.search$.next(value);
  }

  goToAdminPanel() {
    window.location.href = 'http://100.80.240.31:4200/admin-salas';
  }
}