// src/app/pages/user-area/user-area.ts
import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import {
  Observable,
  BehaviorSubject,
  Subject,
  combineLatest,
  map,
  shareReplay,
  interval,
  startWith,
  switchMap,
} from 'rxjs';
import { FormsModule } from '@angular/forms';

type Sala = {
  _id?: string;
  facultad: string;
  numeroSala: number;
  personasDentro: number;
  ruidoDb: number;
  horaEntrada: string | Date;
  horaSalida?: string | Date;
  ultimoReservadoPor?: string;
  ultimoReservadoPorId?: string;
};

type SalaVM = Sala & {
  isFree: boolean;
  timeToFreeText: string | null;
};

@Component({
  selector: 'app-user-area',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './user-area.html',
  styleUrls: ['./user-area.css'],
})
export class UserAreaComponent {
  isAdmin = false;

  userName$: Observable<string>;
  currentUserFullName = '';
  currentUserId = '';

  private readonly salasApiUrl = 'http://100.80.240.31:3000/salas';
  private refreshSalas$ = new Subject<void>();

  salasRaw$: Observable<Sala[]>;
  faculties$: Observable<string[]>;
  salasFiltered$: Observable<SalaVM[]>;
  myReservations$: Observable<SalaVM[]>;

  search = '';
  private search$ = new BehaviorSubject<string>('');

  reserveOpenForId: string | null = null;
  reservationStart = '';
  reservationEnd = '';
  isSavingReservation = false;

  editReservationOpenForId: string | null = null;
  editReservationEnd = '';
  isSavingReservationEdit = false;

  constructor(private auth: AuthService, private http: HttpClient) {
    this.isAdmin = this.auth.isAdmin();

    const jwtUser = this.auth.getUser();
    this.currentUserId = ((jwtUser as any)?.sub as string) || '';

    this.userName$ = this.http.get<any>(`http://100.80.240.31:3001/users/${this.currentUserId}`).pipe(
      map((u) => `${u.firstName} ${u.lastName}`.trim()),
      shareReplay(1)
    );

    this.userName$.subscribe((name) => {
      this.currentUserFullName = name;
    });

    this.salasRaw$ = this.refreshSalas$.pipe(
      startWith(void 0),
      switchMap(() => this.http.get<Sala[]>(this.salasApiUrl)),
      shareReplay(1)
    );

    this.faculties$ = this.salasRaw$.pipe(
      map((salas) =>
        Array.from(new Set(salas.map((s) => (s.facultad || '').trim())))
          .filter(Boolean)
          .sort()
      ),
      shareReplay(1)
    );

    const tick$ = interval(1000).pipe(startWith(0));

    this.salasFiltered$ = combineLatest([this.salasRaw$, this.search$, tick$]).pipe(
      map(([salas, term]) => {
        const t = (term || '').trim().toLowerCase();

        const filtered = !t
          ? salas
          : salas.filter((s) => {
              const fac = (s.facultad || '').toLowerCase();
              const num = String(s.numeroSala ?? '').toLowerCase();
              return fac.includes(t) || num.includes(t);
            });

        return filtered.map((s) => this.toSalaVM(s));
      })
    );

    this.myReservations$ = combineLatest([this.salasRaw$, tick$]).pipe(
      map(([salas]) => {
        const mine = salas.filter((s) => {
          const reservedByMe =
            !!this.currentUserId &&
            (s.ultimoReservadoPorId || '').trim() === this.currentUserId;

          const stillActive =
            !!s.horaSalida && new Date(s.horaSalida as any).getTime() > Date.now();

          return reservedByMe && stillActive;
        });

        return mine
          .map((s) => this.toSalaVM(s))
          .sort((a, b) => {
            const aTime = a.horaSalida ? new Date(a.horaSalida as any).getTime() : 0;
            const bTime = b.horaSalida ? new Date(b.horaSalida as any).getTime() : 0;
            return aTime - bTime;
          });
      })
    );
  }

  private toSalaVM(s: Sala): SalaVM {
    const now = Date.now();
    const hasFutureEnd = !!s.horaSalida && new Date(s.horaSalida as any).getTime() > now;
    const isFree = (s.personasDentro ?? 0) === 0 || !hasFutureEnd;

    let timeToFreeText: string | null = null;

    if (!isFree && s.horaSalida) {
      const end = new Date(s.horaSalida as any).getTime();
      const diff = end - now;

      if (Number.isFinite(diff) && diff > 0) {
        const totalSeconds = Math.floor(diff / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        timeToFreeText =
          hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
      } else {
        timeToFreeText = '0m 0s';
      }
    }

    return { ...s, isFree, timeToFreeText };
  }

  onSearchChange(value: string) {
    this.search$.next(value);
  }

  openReserveForm(sala: SalaVM) {
    this.reserveOpenForId = sala._id || null;

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    this.reservationStart = this.toDatetimeLocalValue(now);
    this.reservationEnd = this.toDatetimeLocalValue(oneHourLater);
  }

  cancelReservation() {
    this.reserveOpenForId = null;
    this.reservationStart = '';
    this.reservationEnd = '';
  }

  confirmReservation(sala: SalaVM) {
    if (!sala._id) {
      alert('Room id not found');
      return;
    }

    if (!this.reservationStart || !this.reservationEnd) {
      alert('Please select entry and exit times');
      return;
    }

    const startDate = new Date(this.reservationStart);
    const endDate = new Date(this.reservationEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert('Invalid date');
      return;
    }

    if (endDate <= startDate) {
      alert('Exit time must be later than entry time');
      return;
    }

    this.isSavingReservation = true;

    const body = {
      personasDentro: 1,
      horaEntrada: startDate.toISOString(),
      horaSalida: endDate.toISOString(),
      ultimoReservadoPor: this.currentUserFullName || 'Usuario desconocido',
      ultimoReservadoPorId: this.currentUserId || '',
    };

    this.http.put(`${this.salasApiUrl}/${sala._id}`, body).subscribe({
      next: () => {
        this.isSavingReservation = false;
        this.cancelReservation();
        this.refreshSalas$.next();
      },
      error: () => {
        this.isSavingReservation = false;
        alert('The reservation could not be saved');
      },
    });
  }

  openEditReservationForm(sala: SalaVM) {
    if (!sala._id) return;

    this.editReservationOpenForId = sala._id;
    this.editReservationEnd = sala.horaSalida
      ? this.toDatetimeLocalValue(new Date(sala.horaSalida as any))
      : '';
  }

  cancelEditReservation() {
    this.editReservationOpenForId = null;
    this.editReservationEnd = '';
  }

  saveReservationEdit(sala: SalaVM) {
    if (!sala._id) {
      alert('Room id not found');
      return;
    }

    if (!this.editReservationEnd) {
      alert('Please select a new exit time');
      return;
    }

    const currentStart = new Date(sala.horaEntrada as any);
    const currentEnd = sala.horaSalida ? new Date(sala.horaSalida as any) : null;
    const newEnd = new Date(this.editReservationEnd);

    if (isNaN(newEnd.getTime())) {
      alert('Invalid date');
      return;
    }

    if (newEnd <= currentStart) {
      alert('Exit time must be later than entry time');
      return;
    }

    if (currentEnd && newEnd <= currentEnd) {
      alert('The new exit time must be later than the current one');
      return;
    }

    this.isSavingReservationEdit = true;

    const body = {
      personasDentro: 1,
      horaEntrada: new Date(sala.horaEntrada as any).toISOString(),
      horaSalida: newEnd.toISOString(),
      ultimoReservadoPor: sala.ultimoReservadoPor || this.currentUserFullName || 'Usuario desconocido',
      ultimoReservadoPorId: sala.ultimoReservadoPorId || this.currentUserId || '',
    };

    this.http.put(`${this.salasApiUrl}/${sala._id}`, body).subscribe({
      next: () => {
        this.isSavingReservationEdit = false;
        this.cancelEditReservation();
        this.refreshSalas$.next();
      },
      error: () => {
        this.isSavingReservationEdit = false;
        alert('The reservation could not be updated');
      },
    });
  }

  private toDatetimeLocalValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  goToAdminPanel() {
    const token = this.auth.getToken();
    if (!token) return;

    const adminUrl = `http://100.80.240.31:4200/admin-salas?token=${encodeURIComponent(token)}`;
    window.location.href = adminUrl;
  }

  logout() {
    this.auth.logout();
  }
}