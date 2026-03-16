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
  merge,
  of,
} from 'rxjs';
import { FormsModule } from '@angular/forms';

type Sala = {
  _id?: string;
  facultad: string;
  numeroSala: number;
  personasDentro: number;
  ruidoDb: number;
  horaEntrada?: string | Date | null;
  horaSalida?: string | Date | null;
  ultimoReservadoPor?: string;
  ultimoReservadoPorId?: string;
};

type SalaVM = Sala & {
  isFree: boolean;
  timeToFreeText: string | null;
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

type ReservaVM = ReservaApi & {
  isActiveNow: boolean;
  statusLabel: string;
  countdownLabel: string;
  countdownValue: string;
};

type LibraryApi = {
  _id: string;
  name: string;
  lat: number;
  lng: number;
};

type LibraryPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type CalendarSlotVM = {
  startIso: string;
  endIso: string;
  label: string;
  statusLabel: string;
};

type CalendarDayVM = {
  key: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  slots: CalendarSlotVM[];
};

type RoomCalendarMap = Record<string, CalendarDayVM[]>;

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
  private readonly reservasApiUrl = 'http://100.80.240.31:3000/reservas';
  private readonly librariesApiUrl = 'http://100.80.240.31:3002/libraries';
  private readonly calendarDaysCount = 7;

  private refreshData$ = new Subject<void>();

  salasRaw$: Observable<Sala[]>;
  faculties$: Observable<string[]>;
  salasFiltered$: Observable<SalaVM[]>;
  allReservationsRaw$: Observable<ReservaApi[]>;
  roomCalendarMap$: Observable<RoomCalendarMap>;
  myReservationsRaw$: Observable<ReservaApi[]>;
  myReservations$: Observable<ReservaVM[]>;
  hasUpcomingReservation$: Observable<boolean>;
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

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.isAdmin = this.auth.isAdmin();

    const jwtUser = this.auth.getUser();
    this.currentUserId = ((jwtUser as any)?.sub as string) || '';

    this.userName$ = this.http
      .get<any>(`http://100.80.240.31:3001/users/${this.currentUserId}`)
      .pipe(
        map((u) => `${u.firstName} ${u.lastName}`.trim()),
        shareReplay(1)
      );

    this.userName$.subscribe((name) => {
      this.currentUserFullName = name;
    });

    const refreshTrigger$ = merge(this.refreshData$, interval(30000)).pipe(startWith(0));
    const tick$ = interval(1000).pipe(startWith(0));

    this.salasRaw$ = refreshTrigger$.pipe(
      switchMap(() => this.http.get<Sala[]>(this.salasApiUrl)),
      shareReplay(1)
    );

    this.allReservationsRaw$ = refreshTrigger$.pipe(
      switchMap(() => this.http.get<ReservaApi[]>(this.reservasApiUrl)),
      map((reservas) => this.filterCalendarReservations(reservas)),
      shareReplay(1)
    );

    this.roomCalendarMap$ = this.allReservationsRaw$.pipe(
      map((reservas) => this.buildRoomCalendarMap(reservas)),
      shareReplay(1)
    );

    this.myReservationsRaw$ = refreshTrigger$.pipe(
      switchMap(() => {
        if (!this.currentUserId) return of([]);
        return this.http.get<ReservaApi[]>(
          `${this.reservasApiUrl}/user/${this.currentUserId}/upcoming`
        );
      }),
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

    this.myReservations$ = combineLatest([this.myReservationsRaw$, tick$]).pipe(
      map(([reservas]) =>
        reservas
          .filter((r) => new Date(r.horaSalida as any).getTime() > Date.now())
          .map((r) => this.toReservaVM(r))
          .sort(
            (a, b) =>
              new Date(a.horaEntrada as any).getTime() -
              new Date(b.horaEntrada as any).getTime()
          )
      ),
      shareReplay(1)
    );

    this.hasUpcomingReservation$ = this.myReservations$.pipe(
      map((reservations) => reservations.length > 0),
      shareReplay(1)
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
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.viewMode === 'map') {
      await this.initMap();
      this.loadLibrariesFromApi();
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markersLayer = null;
    }

    this.refreshData$.complete();
  }

  private toSalaVM(s: Sala): SalaVM {
    const now = Date.now();
    const hasFutureEnd =
      !!s.horaSalida && new Date(s.horaSalida as any).getTime() > now;
    const isFree = (s.personasDentro ?? 0) === 0 || !hasFutureEnd;

    let timeToFreeText: string | null = null;

    if (!isFree && s.horaSalida) {
      const diff = new Date(s.horaSalida as any).getTime() - now;
      timeToFreeText = this.formatRemaining(diff);
    }

    return { ...s, isFree, timeToFreeText };
  }

  private toReservaVM(r: ReservaApi): ReservaVM {
    const now = Date.now();
    const start = new Date(r.horaEntrada as any).getTime();
    const end = new Date(r.horaSalida as any).getTime();

    const isActiveNow = start <= now && end > now;

    return {
      ...r,
      isActiveNow,
      statusLabel: isActiveNow ? 'Active' : 'Upcoming',
      countdownLabel: isActiveNow ? 'Ends in' : 'Starts',
      countdownValue: isActiveNow
        ? this.formatRemaining(end - now)
        : new Date(r.horaEntrada as any).toLocaleString(),
    };
  }

  getCalendarDaysForRoom(roomId: string | undefined, roomCalendarMap: RoomCalendarMap): CalendarDayVM[] {
  if (roomId && roomCalendarMap[roomId]) {
    return roomCalendarMap[roomId];
  }

  return roomCalendarMap['__empty__'] || [];
}

  private filterCalendarReservations(reservas: ReservaApi[]): ReservaApi[] {
    const windowStart = this.startOfDay(new Date()).getTime();
    const windowEnd = this.addDays(this.startOfDay(new Date()), this.calendarDaysCount).getTime();

    return reservas.filter((r) => {
      const start = new Date(r.horaEntrada as any).getTime();
      const end = new Date(r.horaSalida as any).getTime();

      return Number.isFinite(start) && Number.isFinite(end) && end > windowStart && start < windowEnd;
    });
  }

  private buildRoomCalendarMap(reservas: ReservaApi[]): RoomCalendarMap {
    const skeleton = this.createCalendarSkeleton();
    const roomMap: RoomCalendarMap = {
      __empty__: skeleton,
    };

    for (const reserva of reservas) {
      const roomId = (reserva.salaId || '').trim();
      if (!roomId) continue;

      const start = new Date(reserva.horaEntrada as any);
      const end = new Date(reserva.horaSalida as any);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      if (!roomMap[roomId]) {
        roomMap[roomId] = this.cloneCalendarSkeleton(skeleton);
      }

      for (const day of roomMap[roomId]) {
        const dayStart = this.parseDayKey(day.key);
        const dayEnd = this.addDays(dayStart, 1);

        if (start < dayEnd && end > dayStart) {
          const slotStart = start > dayStart ? start : dayStart;
          const slotEnd = end < dayEnd ? end : dayEnd;

          day.slots.push({
            startIso: slotStart.toISOString(),
            endIso: slotEnd.toISOString(),
            label: `${this.formatHourMinute(slotStart)} – ${this.formatHourMinute(slotEnd)}`,
            statusLabel: 'Occupied',
          });
        }
      }
    }

    for (const roomId of Object.keys(roomMap)) {
      roomMap[roomId].forEach((day) => {
        day.slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
      });
    }

    return roomMap;
  }

  private createCalendarSkeleton(): CalendarDayVM[] {
    const today = this.startOfDay(new Date());
    const todayKey = this.toDayKey(today);

    return Array.from({ length: this.calendarDaysCount }, (_, index) => {
      const date = this.addDays(today, index);

      return {
        key: this.toDayKey(date),
        dayLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        isToday: this.toDayKey(date) === todayKey,
        slots: [],
      };
    });
  }

  private cloneCalendarSkeleton(days: CalendarDayVM[]): CalendarDayVM[] {
    return days.map((day) => ({
      ...day,
      slots: [],
    }));
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private toDayKey(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private parseDayKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private formatHourMinute(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private formatRemaining(diff: number): string {
    if (!Number.isFinite(diff) || diff <= 0) return '0m 0s';

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
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

  confirmReservation() {
    if (!this.reserveOpenForId) {
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

    if (endDate.getTime() - startDate.getTime() > 3 * 60 * 60 * 1000) {
      alert('The maximum reservation time is 3 hours');
      return;
    }

    this.isSavingReservation = true;

    const body = {
      salaId: this.reserveOpenForId,
      userId: this.currentUserId || '',
      userName: this.currentUserFullName || 'Usuario desconocido',
      horaEntrada: startDate.toISOString(),
      horaSalida: endDate.toISOString(),
    };

    this.http.post(this.reservasApiUrl, body).subscribe({
      next: () => {
        this.isSavingReservation = false;
        this.cancelReservation();
        this.refreshData$.next();
      },
      error: (error) => {
        this.isSavingReservation = false;
        alert(this.getErrorMessage(error, 'The reservation could not be saved'));
      },
    });
  }

  openEditReservationForm(reserva: ReservaVM) {
    if (!reserva._id) return;

    this.editReservationOpenForId = reserva._id;
    this.editReservationEnd = reserva.horaSalida
      ? this.toDatetimeLocalValue(new Date(reserva.horaSalida as any))
      : '';
  }

  cancelEditReservation() {
    this.editReservationOpenForId = null;
    this.editReservationEnd = '';
  }

  saveReservationEdit(reserva: ReservaVM) {
    if (!reserva._id) {
      alert('Reservation id not found');
      return;
    }

    if (!this.editReservationEnd) {
      alert('Please select a new exit time');
      return;
    }

    const currentStart = new Date(reserva.horaEntrada as any);
    const currentEnd = new Date(reserva.horaSalida as any);
    const newEnd = new Date(this.editReservationEnd);

    if (isNaN(newEnd.getTime())) {
      alert('Invalid date');
      return;
    }

    if (newEnd <= currentStart) {
      alert('Exit time must be later than entry time');
      return;
    }

    if (newEnd <= currentEnd) {
      alert('The new exit time must be later than the current one');
      return;
    }

    if (newEnd.getTime() - currentStart.getTime() > 3 * 60 * 60 * 1000) {
      alert('The maximum reservation time is 3 hours');
      return;
    }

    this.isSavingReservationEdit = true;

    const body = {
      userId: this.currentUserId,
      horaSalida: newEnd.toISOString(),
    };

    this.http.patch(`${this.reservasApiUrl}/${reserva._id}`, body).subscribe({
      next: () => {
        this.isSavingReservationEdit = false;
        this.cancelEditReservation();
        this.refreshData$.next();
      },
      error: (error) => {
        this.isSavingReservationEdit = false;
        alert(this.getErrorMessage(error, 'The reservation could not be updated'));
      },
    });
  }

  private getErrorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;

    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    return fallback;
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
      this.loadLibrariesFromApi();
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
      zoomControl: false,
      attributionControl: false,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '',
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

  private loadLibrariesFromApi() {
    this.http.get<LibraryApi[]>(this.librariesApiUrl).subscribe({
      next: (libraries) => {
        this.ngZone.run(() => {
          this.libraries = libraries.map((lib) => ({
            id: lib._id,
            name: lib.name,
            lat: lib.lat,
            lng: lib.lng,
          }));

          this.renderLibraryMarkers();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        alert('Could not load libraries');
      },
    });
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
        const updatedLat = Number(latlng.lat.toFixed(6));
        const updatedLng = Number(latlng.lng.toFixed(6));

        this.http.patch(`${this.librariesApiUrl}/${library.id}`, {
          lat: updatedLat,
          lng: updatedLng,
        }).subscribe({
          next: () => {
            library.lat = updatedLat;
            library.lng = updatedLng;
            this.renderLibraryMarkers();
          },
          error: () => {
            alert('The library position could not be updated');
            this.loadLibrariesFromApi();
          },
        });
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

    const body = {
      name,
      lat: this.pendingLibraryLat,
      lng: this.pendingLibraryLng,
    };

    this.http.post<LibraryApi>(this.librariesApiUrl, body).subscribe({
      next: (newLibrary) => {
        this.libraries = [
          ...this.libraries,
          {
            id: newLibrary._id,
            name: newLibrary.name,
            lat: newLibrary.lat,
            lng: newLibrary.lng,
          },
        ];
        this.renderLibraryMarkers();
        this.cancelAddLibraryMode();
      },
      error: () => {
        alert('The library could not be saved');
      },
    });
  }

  removeLibrary(libraryId: string) {
    if (!this.isAdmin) return;

    const confirmed = window.confirm('Do you want to delete this library from the map?');
    if (!confirmed) return;

    this.http.delete(`${this.librariesApiUrl}/${libraryId}`).subscribe({
      next: () => {
        this.libraries = this.libraries.filter((lib) => lib.id !== libraryId);
        this.renderLibraryMarkers();
      },
      error: () => {
        alert('The library could not be deleted');
      },
    });
  }
}