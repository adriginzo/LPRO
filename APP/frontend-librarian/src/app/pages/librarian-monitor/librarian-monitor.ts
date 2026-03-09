import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Observable, startWith, switchMap, map, shareReplay } from 'rxjs';
import { SalasService, Sala } from '../../services/salas';

type NoiseLevel = 'good' | 'warning' | 'danger';

type SalaVM = Sala & {
  isFree: boolean;
  noiseLevel: NoiseLevel | null;
  showNoiseAlert: boolean;
};

type NoiseAlert = {
  id: string;
  facultad: string;
  numeroSala: number;
  ruidoDb: number;
};

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
  lastUpdate$: Observable<Date>;

  constructor(private salasService: SalasService) {
    this.salas$ = interval(1000).pipe(
      startWith(0),
      switchMap(() => this.salasService.getSalas()),
      map((salas) =>
        salas.map((s) => {
          const isFree = (s.personasDentro ?? 0) === 0;
          const noiseLevel = isFree ? null : this.getNoiseLevel(s.ruidoDb ?? 0);

          return {
            ...s,
            isFree,
            noiseLevel,
            showNoiseAlert: !isFree && noiseLevel === 'danger'
          } as SalaVM;
        })
      ),
      shareReplay(1)
    );

    this.alerts$ = this.salas$.pipe(
      map((salas) =>
        salas
          .filter((s) => s.showNoiseAlert)
          .map((s) => ({
            id: s._id || `${s.facultad}-${s.numeroSala}`,
            facultad: s.facultad,
            numeroSala: s.numeroSala,
            ruidoDb: s.ruidoDb ?? 0
          }))
      ),
      shareReplay(1)
    );

    this.lastUpdate$ = interval(1000).pipe(
      startWith(0),
      map(() => new Date())
    );
  }

  private getNoiseLevel(ruidoDb: number): NoiseLevel {
    if (ruidoDb <= 40) return 'good';
    if (ruidoDb <= 70) return 'warning';
    return 'danger';
  }

  trackBySala(index: number, sala: SalaVM): string {
    return sala._id || `${sala.facultad}-${sala.numeroSala}-${index}`;
  }

  trackByAlert(index: number, alert: NoiseAlert): string {
    return alert.id || `${alert.facultad}-${alert.numeroSala}-${index}`;
  }
}