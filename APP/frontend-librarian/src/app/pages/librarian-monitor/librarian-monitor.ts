import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  catchError,
  defer,
  map,
  Observable,
  of,
  repeat,
  scan,
  shareReplay
} from 'rxjs';
import { SalasService, Sala } from '../../services/salas';

type NoiseLevel = 'good' | 'warning' | 'danger';

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

type SalaVM = Sala & {
  isFree: boolean;
  noiseLevel: NoiseLevel | null;
  showNoiseAlert: boolean;
  displayReservedBy: string;
  flashUntil: FlashUntil;
  flash: FlashState;
};

type NoiseAlert = {
  id: string;
  facultad: string;
  numeroSala: number;
  ruidoDb: number;
};

type MonitorSummary = {
  totalRooms: number;
  freeRooms: number;
  occupiedRooms: number;
  activeAlerts: number;
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
  salas$: Observable<SalaVM[]>;
  alerts$: Observable<NoiseAlert[]>;
  summary$: Observable<MonitorSummary>;
  lastUpdate$: Observable<Date>;

  constructor(private salasService: SalasService) {
    this.salas$ = defer(() =>
      this.salasService.getSalas().pipe(
        catchError(() => of([] as Sala[]))
      )
    ).pipe(
      repeat({ delay: LIVE_POLL_DELAY_MS }),
      map((salas) =>
        [...salas].sort(
          (a, b) =>
            a.facultad.localeCompare(b.facultad) ||
            a.numeroSala - b.numeroSala
        )
      ),
      scan((previousSalas, currentSalas) => {
        const previousMap = new Map(
          previousSalas.map((s) => [this.getSalaKey(s), s])
        );
        const now = Date.now();

        return currentSalas.map((s) => {
          const key = this.getSalaKey(s);
          const previous = previousMap.get(key);

          const isFree = (s.personasDentro ?? 0) === 0;
          const noiseLevel = isFree ? null : this.getNoiseLevel(s.ruidoDb ?? 0);
          const displayReservedBy =
            (s.ultimoReservadoPor ?? '').trim() || 'No reservation recorded';

          const previousReservedBy =
            (previous?.displayReservedBy ?? previous?.ultimoReservadoPor ?? '').trim() ||
            'No reservation recorded';

          const peopleChanged =
            !!previous && (previous.personasDentro ?? 0) !== (s.personasDentro ?? 0);

          const noiseChanged =
            !!previous && (previous.ruidoDb ?? 0) !== (s.ruidoDb ?? 0);

          const reservedByChanged =
            !!previous && previousReservedBy !== displayReservedBy;

          const statusChanged =
            !!previous && previous.isFree !== isFree;

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
            isFree,
            noiseLevel,
            showNoiseAlert: !isFree && noiseLevel === 'danger',
            displayReservedBy,
            flashUntil,
            flash
          } as SalaVM;
        });
      }, [] as SalaVM[]),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.alerts$ = this.salas$.pipe(
      map((salas) =>
        salas
          .filter((s) => s.showNoiseAlert)
          .sort((a, b) => (b.ruidoDb ?? 0) - (a.ruidoDb ?? 0))
          .map((s) => ({
            id: s._id || `${s.facultad}-${s.numeroSala}`,
            facultad: s.facultad,
            numeroSala: s.numeroSala,
            ruidoDb: s.ruidoDb ?? 0
          }))
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.summary$ = this.salas$.pipe(
      map((salas) => {
        const totalRooms = salas.length;
        const freeRooms = salas.filter((s) => s.isFree).length;
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

    this.lastUpdate$ = this.salas$.pipe(
      map(() => new Date()),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private getNoiseLevel(ruidoDb: number): NoiseLevel {
    if (ruidoDb <= 40) return 'good';
    if (ruidoDb <= 70) return 'warning';
    return 'danger';
  }

  private getSalaKey(sala: Pick<Sala, '_id' | 'facultad' | 'numeroSala'>): string {
    return sala._id || `${sala.facultad}-${sala.numeroSala}`;
  }

  trackBySala(index: number, sala: SalaVM): string {
    return sala._id || `${sala.facultad}-${sala.numeroSala}-${index}`;
  }

  trackByAlert(index: number, alert: NoiseAlert): string {
    return alert.id || `${alert.facultad}-${alert.numeroSala}-${index}`;
  }
}