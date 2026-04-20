import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  defer,
  forkJoin,
  map,
  Observable,
  of,
  repeat,
  scan,
  shareReplay,
} from 'rxjs';
import { SalasService, Sala } from '../../services/salas';
import { LibrarianAuthService } from '../../services/librarian-auth';

type NoiseLevel = 'warning' | 'danger';
type AlertSeverity = 'default' | 'warning' | 'danger';
type RoomStatus = 'free' | 'reserved' | 'occupied';
type ReservationStatus = 'active' | 'upcoming' | 'past';

type FlashUntil = {
  panel: number;
  status: number;
  people: number;
  noise: number;
  reservedBy: number;
};

type FlashState = {
  panel: boolean;
  status: boolean;
  people: boolean;
  noise: boolean;
  reservedBy: boolean;
};

type ReservaApi = {
  _id: string;
  salaId: string;
  facultad: string;
  numeroSala: number;
  userId: string;
  userName: string;
  horaEntrada: string | Date;
  horaSalida: string | Date;
};

type RoomReservationVM = ReservaApi & {
  status: ReservationStatus;
  statusLabel: string;
};

type SalaVM = Sala & {
  isFree: boolean;
  roomStatus: RoomStatus;
  stateLabel: string;
  hasActiveReservation: boolean;
  noiseLevel: NoiseLevel | null;
  alertSeverity: AlertSeverity;
  showNoiseAlert: boolean;
  displayReservedBy: string;
  responsibleLabel: string;
  activeReservationWindow: string;
  flashUntil: FlashUntil;
  flash: FlashState;
};

type NoiseAlert = {
  id: string;
  facultad: string;
  numeroSala: number;
  ruidoDb: number;
  alert: number;
  severity: AlertSeverity;
};

type MonitorSummary = {
  totalRooms: number;
  freeRooms: number;
  occupiedRooms: number;
  activeAlerts: number;
};

type MonitorPayload = {
  salas: Sala[];
  reservas: ReservaApi[];
};

const LIVE_POLL_DELAY_MS = 120;
const FLASH_DURATION_MS = 900;

@Component({
  selector: 'app-librarian-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './librarian-monitor.html',
  styleUrls: ['./librarian-monitor.css']
})
export class LibrarianMonitorComponent {
  librarianName = 'Librarian';
  salas$: Observable<SalaVM[]>;
  alerts$: Observable<NoiseAlert[]>;
  summary$: Observable<MonitorSummary>;
  lastUpdate$: Observable<Date>;
  roomReservations$: Observable<RoomReservationVM[]>;

  roomReservationsOpenForId: string | null = null;
  roomReservationsTitle = '';

  private readonly reservasApiUrl = 'http://100.80.240.31:3000/reservas';
  private readonly selectedRoomReservationsId$ = new BehaviorSubject<string>('');

  constructor(
    private salasService: SalasService,
    private auth: LibrarianAuthService,
    private router: Router,
    private http: HttpClient
  ) {
    const session = this.auth.getSession();
    this.librarianName = (session?.user?.firstName ?? '').trim() || 'Librarian';

    const monitorData$ = defer(() => {
      const librarianSchool = this.normalizeText(
        this.auth.getSession()?.user?.school ?? ''
      );

      return forkJoin({
        salas: this.salasService.getSalas().pipe(
          catchError(() => of([] as Sala[]))
        ),
        reservas: this.http.get<ReservaApi[]>(this.reservasApiUrl).pipe(
          catchError(() => of([] as ReservaApi[]))
        )
      }).pipe(
        map(({ salas, reservas }) => {
          if (!librarianSchool) {
            return {
              salas: [] as Sala[],
              reservas: [] as ReservaApi[]
            };
          }

          const filteredSalas = salas.filter((s) => {
            const roomFaculty = this.normalizeText(s.facultad ?? '');
            return roomFaculty === librarianSchool;
          });

          const roomIds = new Set(
            filteredSalas
              .map((s) => (s._id || '').trim())
              .filter(Boolean)
          );

          const filteredReservas = reservas.filter((r) => {
            const roomId = (r.salaId || '').trim();
            return roomIds.has(roomId);
          });

          return {
            salas: filteredSalas,
            reservas: filteredReservas
          };
        }),
        catchError(() =>
          of({
            salas: [] as Sala[],
            reservas: [] as ReservaApi[]
          })
        )
      );
    }).pipe(
      repeat({ delay: LIVE_POLL_DELAY_MS }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.salas$ = monitorData$.pipe(
      scan((previousSalas, payload) => {
        const currentSalas = [...payload.salas].sort(
          (a, b) =>
            a.facultad.localeCompare(b.facultad) ||
            a.numeroSala - b.numeroSala
        );

        const reservationsByRoom = this.groupReservationsByRoom(payload.reservas);
        const previousMap = new Map(
          previousSalas.map((s) => [this.getSalaKey(s), s])
        );
        const now = Date.now();

        return currentSalas.map((s) => {
          const key = this.getSalaKey(s);
          const previous = previousMap.get(key);

          const roomReservations = this.toRoomReservationsVM(
            reservationsByRoom.get((s._id || '').trim()) || [],
            now
          );

          const activeReservation =
            roomReservations.find((r) => r.status === 'active') || null;

          const hasPeople = (s.personasDentro ?? 0) > 0;
          const hasActiveReservation = !!activeReservation;

          const roomStatus: RoomStatus = hasPeople
            ? 'occupied'
            : hasActiveReservation
            ? 'reserved'
            : 'free';

          const stateLabel =
            roomStatus === 'occupied'
              ? 'Occupied'
              : roomStatus === 'reserved'
              ? 'Reserved'
              : 'Free';

          const noiseLevel =
            roomStatus === 'occupied'
              ? this.getNoiseLevel(s.ruidoDb ?? 0)
              : null;

          const alertSeverity = this.getAlertSeverity(s.ruidoDb ?? 0);

          const displayReservedBy =
            (activeReservation?.userName ?? '').trim() ||
            (s.ultimoReservadoPor ?? '').trim() ||
            'No reservation recorded';

          const responsibleLabel = activeReservation
            ? 'Reserved by'
            : 'Last reserved by';

          const activeReservationWindow = activeReservation
            ? `${this.formatDateTime(activeReservation.horaEntrada)} → ${this.formatDateTime(
                activeReservation.horaSalida
              )}`
            : '';

          const previousReservedBy =
            (previous?.displayReservedBy ?? '').trim() || 'No reservation recorded';

          const peopleChanged =
            !!previous && (previous.personasDentro ?? 0) !== (s.personasDentro ?? 0);

          const noiseChanged =
            !!previous && (previous.ruidoDb ?? 0) !== (s.ruidoDb ?? 0);

          const reservedByChanged =
            !!previous &&
            (previousReservedBy !== displayReservedBy ||
              previous.activeReservationWindow !== activeReservationWindow);

          const statusChanged =
            !!previous && previous.roomStatus !== roomStatus;

          const anyChanged =
            peopleChanged || noiseChanged || reservedByChanged || statusChanged;

          const flashUntil: FlashUntil = {
            panel: anyChanged ? now + FLASH_DURATION_MS : previous?.flashUntil.panel ?? 0,
            status: statusChanged ? now + FLASH_DURATION_MS : previous?.flashUntil.status ?? 0,
            people: peopleChanged ? now + FLASH_DURATION_MS : previous?.flashUntil.people ?? 0,
            noise:
              noiseChanged || statusChanged
                ? now + FLASH_DURATION_MS
                : previous?.flashUntil.noise ?? 0,
            reservedBy: reservedByChanged
              ? now + FLASH_DURATION_MS
              : previous?.flashUntil.reservedBy ?? 0
          };

          const flash: FlashState = {
            panel: flashUntil.panel > now,
            status: flashUntil.status > now,
            people: flashUntil.people > now,
            noise: flashUntil.noise > now,
            reservedBy: flashUntil.reservedBy > now
          };

          return {
            ...s,
            isFree: roomStatus === 'free',
            roomStatus,
            stateLabel,
            hasActiveReservation,
            noiseLevel,
            alertSeverity,
            showNoiseAlert: (s.alert ?? 0) !== 0,
            displayReservedBy,
            responsibleLabel,
            activeReservationWindow,
            flashUntil,
            flash
          } as SalaVM;
        });
      }, [] as SalaVM[]),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.roomReservations$ = combineLatest([
      monitorData$,
      this.selectedRoomReservationsId$
    ]).pipe(
      map(([payload, selectedRoomId]) => {
        const roomId = (selectedRoomId || '').trim();
        if (!roomId) {
          return [];
        }

        return this.toRoomReservationsVM(
          payload.reservas.filter((r) => (r.salaId || '').trim() === roomId),
          Date.now()
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.alerts$ = this.salas$.pipe(
      map((salas) =>
        salas
          .filter((s) => s.showNoiseAlert)
          .sort((a, b) => {
            const alertDiff = (b.alert ?? 0) - (a.alert ?? 0);
            if (alertDiff !== 0) return alertDiff;
            return (b.ruidoDb ?? 0) - (a.ruidoDb ?? 0);
          })
          .map((s) => ({
            id: s._id || `${s.facultad}-${s.numeroSala}`,
            facultad: s.facultad,
            numeroSala: s.numeroSala,
            ruidoDb: s.ruidoDb ?? 0,
            alert: s.alert ?? 0,
            severity: s.alertSeverity
          }))
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.summary$ = this.salas$.pipe(
      map((salas) => {
        const totalRooms = salas.length;
        const freeRooms = salas.filter((s) => s.roomStatus === 'free').length;
        const occupiedRooms = totalRooms - freeRooms;
        const activeAlerts = salas.filter((s) => s.showNoiseAlert).length;

        return {
          totalRooms,
          freeRooms,
          occupiedRooms,
          activeAlerts
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.lastUpdate$ = monitorData$.pipe(
      map(() => new Date()),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  openRoomReservations(sala: SalaVM): void {
    const roomId = (sala._id || '').trim();
    if (!roomId) {
      return;
    }

    this.roomReservationsOpenForId = roomId;
    this.roomReservationsTitle = `${sala.facultad} · Room ${sala.numeroSala}`;
    this.selectedRoomReservationsId$.next(roomId);
  }

  closeRoomReservations(): void {
    this.roomReservationsOpenForId = null;
    this.roomReservationsTitle = '';
    this.selectedRoomReservationsId$.next('');
  }

  private normalizeText(value: string): string {
    return (value ?? '').trim().toLowerCase();
  }

  private getNoiseLevel(ruidoDb: number): NoiseLevel | null {
    if (ruidoDb > 1500) return 'danger';
    if (ruidoDb >= 1200) return 'warning';
    return null;
  }

  private getAlertSeverity(ruidoDb: number): AlertSeverity {
    if (ruidoDb > 1500) return 'danger';
    if (ruidoDb >= 1200) return 'warning';
    return 'default';
  }

  private getSalaKey(sala: Pick<Sala, '_id' | 'facultad' | 'numeroSala'>): string {
    return sala._id || `${sala.facultad}-${sala.numeroSala}`;
  }

  private groupReservationsByRoom(
    reservas: ReservaApi[]
  ): Map<string, ReservaApi[]> {
    const result = new Map<string, ReservaApi[]>();

    for (const reserva of reservas) {
      const roomId = (reserva.salaId || '').trim();
      if (!roomId) continue;

      const current = result.get(roomId) || [];
      current.push(reserva);
      result.set(roomId, current);
    }

    return result;
  }

  private toRoomReservationsVM(
    reservas: ReservaApi[],
    nowMs: number
  ): RoomReservationVM[] {
    return [...reservas]
      .map((reserva) => {
        const start = new Date(reserva.horaEntrada as any).getTime();
        const end = new Date(reserva.horaSalida as any).getTime();

        let status: ReservationStatus = 'past';
        let statusLabel = 'Past';

        if (start <= nowMs && end > nowMs) {
          status = 'active';
          statusLabel = 'Active';
        } else if (start > nowMs) {
          status = 'upcoming';
          statusLabel = 'Upcoming';
        }

        return {
          ...reserva,
          status,
          statusLabel
        };
      })
      .sort((a, b) => {
        const order = { active: 0, upcoming: 1, past: 2 };
        const statusDiff = order[a.status] - order[b.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const aStart = new Date(a.horaEntrada as any).getTime();
        const bStart = new Date(b.horaEntrada as any).getTime();

        if (a.status === 'past' && b.status === 'past') {
          return bStart - aStart;
        }

        return aStart - bStart;
      });
  }

  private formatDateTime(value: string | Date): string {
    const date = new Date(value as any);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleString();
  }

  trackBySala(index: number, sala: SalaVM): string {
    return sala._id || `${sala.facultad}-${sala.numeroSala}-${index}`;
  }

  trackByAlert(index: number, alert: NoiseAlert): string {
    return alert.id || `${alert.facultad}-${alert.numeroSala}-${index}`;
  }

  trackByRoomReservation(index: number, reservation: RoomReservationVM): string {
    return reservation._id || `${reservation.salaId}-${reservation.userId}-${index}`;
  }
}