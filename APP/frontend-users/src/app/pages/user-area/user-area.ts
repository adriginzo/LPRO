// src/app/pages/user-area/user-area.ts
import { Component, AfterViewInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
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

type LibraryPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

@Component({
  selector: 'app-user-area',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './user-area.html',
  styleUrls: ['./user-area.css'],
})
export class UserAreaComponent implements AfterViewInit, OnDestroy {
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
  libraryAvailableRooms$: Observable<SalaVM[]>;

  search = '';
  private search$ = new BehaviorSubject<string>('');

  reserveOpenForId: string | null = null;
  reservationStart = '';
  reservationEnd = '';
  isSavingReservation = false;

  editReservationOpenForId: string | null = null;
  editReservationEnd = '';
  isSavingReservationEdit = false;

  viewMode: 'map' | 'rooms' = 'map';

  selectedLibraryName = '';
  private selectedLibrary$ = new BehaviorSubject<string>('');
  onlyShowFreeRoomsForLibrary = false;

  private map: any;
  private L: any;
  private markersLayer: any;

  libraries: LibraryPoint[] = [];
  isAddLibraryMode = false;
  pendingLibraryLat: number | null = null;
  pendingLibraryLng: number | null = null;
  newLibraryName = '';

  private readonly librariesStorageKey = 'bookit_libraries_map';

  constructor(
  private auth: AuthService,
  private http: HttpClient,
  private ngZone: NgZone,
  private cdr: ChangeDetectorRef
) {
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

    this.libraryAvailableRooms$ = combineLatest([this.salasRaw$, this.selectedLibrary$, tick$]).pipe(
      map(([salas, selectedLibrary]) => {
        const library = (selectedLibrary || '').trim().toLowerCase();
        if (!library) return [];

        return salas
          .filter((s) => (s.facultad || '').trim().toLowerCase() === library)
          .map((s) => this.toSalaVM(s))
          .filter((s) => s.isFree)
          .sort((a, b) => (a.numeroSala ?? 0) - (b.numeroSala ?? 0));
      }),
      shareReplay(1)
    );

    this.libraries = this.loadLibraries();
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.viewMode === 'map') {
      await this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markersLayer = null;
    }
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
    this.onlyShowFreeRoomsForLibrary = false;
    this.selectedLibraryName = '';
    this.selectedLibrary$.next('');
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

  async setViewMode(mode: 'map' | 'rooms') {
    if (mode === this.viewMode) return;

    if (mode === 'rooms') {
      this.viewMode = 'rooms';

      setTimeout(() => {
        if (this.map) {
          this.map.remove();
          this.map = null;
          this.markersLayer = null;
        }
      }, 0);

      return;
    }

    this.viewMode = 'map';

    setTimeout(async () => {
      await this.initMap();
    }, 0);
  }

  async openLibraryRooms(library: LibraryPoint) {
  this.selectedLibraryName = library.name;
  this.selectedLibrary$.next(library.name);
  this.onlyShowFreeRoomsForLibrary = true;
  this.search = library.name;
  this.search$.next(library.name);

  await this.setViewMode('rooms');
  this.cdr.detectChanges();
}

  clearLibraryRoomFilter() {
    this.selectedLibraryName = '';
    this.selectedLibrary$.next('');
    this.onlyShowFreeRoomsForLibrary = false;
    this.search = '';
    this.search$.next('');
  }

  private async initMap(): Promise<void> {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markersLayer = null;
    }

    const leaflet = await import('leaflet');
    this.L = leaflet;

    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

    const iconDefault = this.L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });

    this.L.Marker.prototype.options.icon = iconDefault;

    this.map = this.L.map('bookit-map', {
      center: [42.1699, -8.6878],
      zoom: 15,
      zoomControl: true,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markersLayer = this.L.layerGroup().addTo(this.map);
    this.renderLibraryMarkers();

    if (this.isAdmin) {
      this.map.on('click', (e: any) => {
        if (!this.isAddLibraryMode) return;

        this.pendingLibraryLat = Number(e.latlng.lat.toFixed(6));
        this.pendingLibraryLng = Number(e.latlng.lng.toFixed(6));
      });
    }

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 0);
  }

  private getDefaultLibraries(): LibraryPoint[] {
    return [
      { id: this.createId(), name: 'Teleco', lat: 42.16952, lng: -8.68874 },
      { id: this.createId(), name: 'Minas', lat: 42.16906, lng: -8.68715 },
      { id: this.createId(), name: 'Biologia', lat: 42.167969, lng: -8.680998 },
    ];
  }

  private loadLibraries(): LibraryPoint[] {
    const raw = localStorage.getItem(this.librariesStorageKey);

    if (!raw) {
      const defaults = this.getDefaultLibraries();
      localStorage.setItem(this.librariesStorageKey, JSON.stringify(defaults));
      return defaults;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return this.getDefaultLibraries();
      }

      return parsed;
    } catch {
      return this.getDefaultLibraries();
    }
  }

  private saveLibraries() {
    localStorage.setItem(this.librariesStorageKey, JSON.stringify(this.libraries));
  }

  private renderLibraryMarkers() {
    if (!this.L || !this.markersLayer) return;

    this.markersLayer.clearLayers();

    for (const library of this.libraries) {
      const marker = this.L.marker([library.lat, library.lng], {
        draggable: this.isAdmin,
      });

      marker.bindTooltip(library.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -30],
        className: 'ua-mapLabel',
      });

      marker.on('click', () => {
        this.ngZone.run(() => {
          this.openLibraryRooms(library);
        });
      });

      marker.on('dragend', (event: any) => {
        if (!this.isAdmin) return;

        const latlng = event.target.getLatLng();
        library.lat = Number(latlng.lat.toFixed(6));
        library.lng = Number(latlng.lng.toFixed(6));
        this.saveLibraries();
        this.renderLibraryMarkers();
      });

      marker.addTo(this.markersLayer);
    }
  }

  startAddLibraryMode() {
    if (!this.isAdmin) return;

    this.isAddLibraryMode = true;
    this.pendingLibraryLat = null;
    this.pendingLibraryLng = null;
    this.newLibraryName = '';
  }

  cancelAddLibraryMode() {
    this.isAddLibraryMode = false;
    this.pendingLibraryLat = null;
    this.pendingLibraryLng = null;
    this.newLibraryName = '';
  }

  saveNewLibrary() {
    if (!this.isAdmin) return;

    const name = this.newLibraryName.trim();

    if (!name) {
      alert('Please enter the library name');
      return;
    }

    if (this.pendingLibraryLat === null || this.pendingLibraryLng === null) {
      alert('Click on the map to choose the library position');
      return;
    }

    const newLibrary: LibraryPoint = {
      id: this.createId(),
      name,
      lat: this.pendingLibraryLat,
      lng: this.pendingLibraryLng,
    };

    this.libraries = [...this.libraries, newLibrary];
    this.saveLibraries();
    this.renderLibraryMarkers();
    this.cancelAddLibraryMode();
  }

  removeLibrary(libraryId: string) {
    if (!this.isAdmin) return;

    const confirmed = window.confirm('Do you want to delete this library from the map?');
    if (!confirmed) return;

    this.libraries = this.libraries.filter((lib) => lib.id !== libraryId);
    this.saveLibraries();
    this.renderLibraryMarkers();
  }

  private createId(): string {
    return Math.random().toString(36).slice(2, 11);
  }
}