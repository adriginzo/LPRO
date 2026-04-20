// src/app/pages/user-area/user-area.ts
import { Component, AfterViewInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import {
  Observable,
  BehaviorSubject,
  Subject,
  Subscription,
  combineLatest,
  map,
  shareReplay,
  interval,
  startWith,
  switchMap,
  merge,
  of,
  catchError,
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

type LibraryDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type LibraryOpeningHour = {
  day: LibraryDay;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type LibraryApi = {
  _id: string;
  name: string;
  lat: number;
  lng: number;
  openingHours?: LibraryOpeningHour[];
  slots?: number;
};

type LibraryPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  openingHours: LibraryOpeningHour[];
  slots: number;
};

type CalendarSlotState = 'free' | 'busy' | 'past';

type CalendarSlotVM = {
  startIso: string;
  endIso: string;
  label: string;
  statusLabel: string;
  state: CalendarSlotState;
};

type CalendarDayVM = {
  key: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  isClosed: boolean;
  openingLabel: string;
  slots: CalendarSlotVM[];
  busySlots: CalendarSlotVM[];
};

type RoomCalendarMap = Record<string, CalendarDayVM[]>;

const DAY_ORDER: LibraryDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const JS_DAY_TO_LIBRARY_DAY: Record<number, LibraryDay> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

@Component({
  selector: 'app-user-area',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './user-area.html',
  styleUrls: ['./user-area.css'],
})
export class UserAreaComponent implements AfterViewInit, OnDestroy {
  readonly slotOptions = [5, 10, 15, 25, 30, 60];

  isAdmin = false;

  userName$: Observable<string>;
  currentUserFullName = '';
  currentUserId = '';

  private readonly salasApiUrl = 'http://100.80.240.31:3000/salas';
  private readonly reservasApiUrl = 'http://100.80.240.31:3000/reservas';
  private readonly librariesApiUrl = 'http://100.80.240.31:3002/libraries';
  private readonly calendarDaysCount = 7;

  private refreshData$ = new Subject<void>();
  private librariesSub?: Subscription;

  salasRaw$: Observable<Sala[]>;
  librariesRaw$: Observable<LibraryPoint[]>;
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
  isSavingReservation = false;
  reserveLibraryInfoText = '';

  editReservationOpenForId: string | null = null;
  editReservationEnd = '';
  isSavingReservationEdit = false;
  editStepSeconds = 1800;
  editLibraryInfoText = '';

  isDeletingReservation = false;

  calendarOpenForRoomId: string | null = null;
  calendarOpenRoomTitle = '';

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
  newLibrarySlots = 30;
  newLibraryOpeningHours: LibraryOpeningHour[] = this.createDefaultOpeningHours();

  private reserveSalaContext: SalaVM | null = null;

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private router: Router
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
    const scheduleTick$ = interval(30000).pipe(startWith(0));

    this.salasRaw$ = refreshTrigger$.pipe(
      switchMap(() => this.http.get<Sala[]>(this.salasApiUrl)),
      shareReplay(1)
    );

    this.librariesRaw$ = refreshTrigger$.pipe(
      switchMap(() =>
        this.http.get<LibraryApi[]>(this.librariesApiUrl).pipe(
          catchError(() => of([]))
        )
      ),
      map((libraries) =>
        libraries.map((lib) => ({
          id: lib._id,
          name: lib.name,
          lat: lib.lat,
          lng: lib.lng,
          openingHours: this.normalizeOpeningHours(lib.openingHours),
          slots: this.normalizeSlots(lib.slots),
        }))
      ),
      shareReplay(1)
    );

    this.allReservationsRaw$ = refreshTrigger$.pipe(
      switchMap(() => this.http.get<ReservaApi[]>(this.reservasApiUrl)),
      map((reservas) => this.filterCalendarReservations(reservas)),
      shareReplay(1)
    );

    this.roomCalendarMap$ = combineLatest([
      this.salasRaw$,
      this.allReservationsRaw$,
      this.librariesRaw$,
      scheduleTick$,
    ]).pipe(
      map(([salas, reservas, libraries]) =>
        this.buildRoomCalendarMap(salas, reservas, libraries, new Date())
      ),
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

    this.librariesSub = this.librariesRaw$.subscribe((libraries) => {
      this.ngZone.run(() => {
        this.libraries = libraries;
        this.renderLibraryMarkers();
        this.cdr.markForCheck();
      });
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.viewMode === 'map') {
      await this.initMap();
      this.renderLibraryMarkers();
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markersLayer = null;
    }

    this.librariesSub?.unsubscribe();
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

    return this.createFallbackCalendarDays(new Date());
  }

  openRoomCalendar(sala: SalaVM) {
    this.calendarOpenForRoomId = sala._id || null;
    this.calendarOpenRoomTitle = `${sala.facultad} · Room ${sala.numeroSala}`;
  }

  closeRoomCalendar() {
    this.calendarOpenForRoomId = null;
    this.calendarOpenRoomTitle = '';
  }

  openDirections(library: LibraryPoint): void {
    if (!library || !Number.isFinite(library.lat) || !Number.isFinite(library.lng)) {
      alert('Library coordinates not available');
      return;
    }

    const destination = `${library.lat},${library.lng}`;

    const openGoogleMaps = (origin?: string) => {
      let mapsUrl =
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

      if (origin) {
        mapsUrl += `&origin=${encodeURIComponent(origin)}`;
      }

      mapsUrl += '&travelmode=walking';

      window.location.href = mapsUrl;
    };

    if (!('geolocation' in navigator)) {
      openGoogleMaps();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = `${position.coords.latitude},${position.coords.longitude}`;
        openGoogleMaps(origin);
      },
      () => {
        openGoogleMaps();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  deleteReservation(reserva: ReservaVM): void {
    const reservationId = reserva?._id?.trim();

    if (!reservationId) {
      alert('Reservation id not found');
      return;
    }

    if (this.isDeletingReservation) {
      return;
    }

    this.isDeletingReservation = true;

    this.http.delete<void>(`${this.reservasApiUrl}/${reservationId}`).subscribe({
      next: () => {
        this.isDeletingReservation = false;

        if (this.editReservationOpenForId === reservationId) {
          this.cancelEditReservation();
        }

        this.refreshData$.next();
      },
      error: (error) => {
        this.isDeletingReservation = false;
        alert(this.getErrorMessage(error, 'The reservation could not be deleted'));
      },
    });
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

  private buildRoomCalendarMap(
    salas: Sala[],
    reservas: ReservaApi[],
    libraries: LibraryPoint[],
    now: Date
  ): RoomCalendarMap {
    const result: RoomCalendarMap = {};
    const reservationsByRoom = new Map<string, ReservaApi[]>();

    for (const reserva of reservas) {
      const roomId = (reserva.salaId || '').trim();
      if (!roomId) continue;

      const existing = reservationsByRoom.get(roomId) || [];
      existing.push(reserva);
      reservationsByRoom.set(roomId, existing);
    }

    for (const sala of salas) {
      const roomId = (sala._id || '').trim();
      if (!roomId) continue;

      const library =
        this.findLibraryByNameFromList(sala.facultad, libraries) ||
        this.createFallbackLibrary(sala.facultad);

      const roomReservations = reservationsByRoom.get(roomId) || [];

      result[roomId] = this.buildCalendarDaysForRoom(
        library,
        roomReservations,
        now
      );
    }

    return result;
  }

  private buildCalendarDaysForRoom(
    library: LibraryPoint,
    reservas: ReservaApi[],
    now: Date
  ): CalendarDayVM[] {
    const today = this.startOfDay(now);

    return Array.from({ length: this.calendarDaysCount }, (_, index) => {
      const date = this.addDays(today, index);
      const dayKey = this.toDayKey(date);
      const dayConfig = this.getDayConfigForDate(library, date);

      if (!dayConfig || !dayConfig.isOpen) {
        return {
          key: dayKey,
          dayLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }),
          dateLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          isToday: index === 0,
          isClosed: true,
          openingLabel: 'Closed',
          slots: [],
          busySlots: [],
        };
      }

      const openDate = this.withTime(date, dayConfig.openTime);
      const closeDate = this.withTime(date, dayConfig.closeTime);
      const slotMinutes = library.slots || 30;

      const slots: CalendarSlotVM[] = [];

      for (
        let slotStart = new Date(openDate);
        slotStart.getTime() < closeDate.getTime();
        slotStart = new Date(slotStart.getTime() + slotMinutes * 60 * 1000)
      ) {
        const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000);

        if (slotEnd.getTime() > closeDate.getTime()) {
          break;
        }

        const isBusy = reservas.some((reserva) => {
          const reservaStart = new Date(reserva.horaEntrada as any).getTime();
          const reservaEnd = new Date(reserva.horaSalida as any).getTime();

          return reservaStart < slotEnd.getTime() && reservaEnd > slotStart.getTime();
        });

        const isPast = slotEnd.getTime() <= now.getTime();

        const state: CalendarSlotState = isBusy
          ? 'busy'
          : isPast
          ? 'past'
          : 'free';

        slots.push({
          startIso: slotStart.toISOString(),
          endIso: slotEnd.toISOString(),
          label: `${this.formatHourMinute(slotStart)} – ${this.formatHourMinute(slotEnd)}`,
          statusLabel:
            state === 'busy'
              ? 'Occupied'
              : state === 'past'
              ? 'Past'
              : 'Available',
          state,
        });
      }

      return {
        key: dayKey,
        dayLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        isToday: index === 0,
        isClosed: false,
        openingLabel: `${dayConfig.openTime} - ${dayConfig.closeTime}`,
        slots,
        busySlots: slots.filter((slot) => slot.state === 'busy'),
      };
    });
  }

  private createFallbackCalendarDays(now: Date): CalendarDayVM[] {
    const today = this.startOfDay(now);

    return Array.from({ length: this.calendarDaysCount }, (_, index) => {
      const date = this.addDays(today, index);

      return {
        key: this.toDayKey(date),
        dayLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        isToday: index === 0,
        isClosed: false,
        openingLabel: '',
        slots: [],
        busySlots: [],
      };
    });
  }

  formatSlotLabel(slot: number): string {
    return slot === 60 ? '1 hour' : `${slot} minutes`;
  }

  getDayLabel(day: LibraryDay): string {
    switch (day) {
      case 'monday':
        return 'Monday';
      case 'tuesday':
        return 'Tuesday';
      case 'wednesday':
        return 'Wednesday';
      case 'thursday':
        return 'Thursday';
      case 'friday':
        return 'Friday';
      case 'saturday':
        return 'Saturday';
      case 'sunday':
        return 'Sunday';
      default:
        return day;
    }
  }

  getTodayOpeningText(library: LibraryPoint): string {
    const config = this.getDayConfigForDate(library, new Date());

    if (!config || !config.isOpen) {
      return 'Closed today';
    }

    return `${config.openTime} - ${config.closeTime}`;
  }

  onSearchChange(value: string) {
    this.onlyShowFreeRoomsForLibrary = false;
    this.selectedLibraryName = '';
    this.selectedLibrary$.next('');
    this.search$.next(value);
  }

  openReserveForm(sala: SalaVM) {
    this.reserveOpenForId = sala._id || null;
    this.reserveSalaContext = sala;

    const library = this.findLibraryByName(sala.facultad);

    this.reserveLibraryInfoText = library
      ? `${library.name} · ${this.getTodayOpeningText(library)} · Click an available slot to reserve it`
      : 'Click an available slot to reserve it';
  }

  reserveSlot(slot: CalendarSlotVM) {
    if (!this.reserveOpenForId) {
      alert('Room id not found');
      return;
    }

    if (!this.currentUserId) {
      alert('User id not found');
      return;
    }

    if (this.isSavingReservation || slot.state !== 'free') {
      return;
    }

    const startDate = new Date(slot.startIso);
    const endDate = new Date(slot.endIso);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert('Invalid slot');
      return;
    }

    this.isSavingReservation = true;

    const body = {
      salaId: this.reserveOpenForId,
      userId: this.currentUserId,
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

  cancelReservation() {
    this.reserveOpenForId = null;
    this.isSavingReservation = false;
    this.reserveLibraryInfoText = '';
    this.reserveSalaContext = null;
  }

  openEditReservationForm(reserva: ReservaVM) {
    if (!reserva._id) return;

    this.editReservationOpenForId = reserva._id;
    this.editReservationEnd = reserva.horaSalida
      ? this.toDatetimeLocalValue(new Date(reserva.horaSalida as any))
      : '';

    const library = this.findLibraryByName(reserva.facultad);
    const slotMinutes = library?.slots ?? 30;

    this.editStepSeconds = slotMinutes * 60;
    this.editLibraryInfoText = library
      ? `${library.name} · ${this.getTodayOpeningText(library)} · Reservation slots every ${this.formatSlotLabel(slotMinutes)}`
      : `Reservation slots every ${this.formatSlotLabel(slotMinutes)}`;
  }

  cancelEditReservation() {
    this.editReservationOpenForId = null;
    this.editReservationEnd = '';
    this.editStepSeconds = 1800;
    this.editLibraryInfoText = '';
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

    const library = this.findLibraryByName(reserva.facultad);
    const rulesError = this.validateReservationAgainstLibraryRules(
      currentStart,
      newEnd,
      library
    );

    if (rulesError) {
      alert(rulesError);
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

  goToShuttle() {
    this.router.navigate(['/shuttle']);
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
      this.renderLibraryMarkers();
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
            this.refreshData$.next();
          },
          error: () => {
            alert('The library position could not be updated');
            this.refreshData$.next();
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
    this.newLibrarySlots = 30;
    this.newLibraryOpeningHours = this.createDefaultOpeningHours();
    this.refreshMapSizeSoon();
  }

  cancelAddLibraryMode() {
    this.isAddLibraryMode = false;
    this.pendingLibraryLat = null;
    this.pendingLibraryLng = null;
    this.newLibraryName = '';
    this.newLibrarySlots = 30;
    this.newLibraryOpeningHours = this.createDefaultOpeningHours();
    this.refreshMapSizeSoon();
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

    if (!this.slotOptions.includes(this.newLibrarySlots)) {
      alert('Invalid reservation slot');
      return;
    }

    const openingHoursError = this.validateOpeningHoursInput(this.newLibraryOpeningHours);
    if (openingHoursError) {
      alert(openingHoursError);
      return;
    }

    const body = {
      name,
      lat: this.pendingLibraryLat,
      lng: this.pendingLibraryLng,
      slots: this.newLibrarySlots,
      openingHours: this.newLibraryOpeningHours.map((day) => ({ ...day })),
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
            openingHours: this.normalizeOpeningHours(newLibrary.openingHours),
            slots: this.normalizeSlots(newLibrary.slots),
          },
        ];
        this.renderLibraryMarkers();
        this.cancelAddLibraryMode();
        this.refreshData$.next();
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
        this.refreshData$.next();
      },
      error: () => {
        alert('The library could not be deleted');
      },
    });
  }

  private createDefaultOpeningHours(): LibraryOpeningHour[] {
    return DAY_ORDER.map((day) => ({
      day,
      isOpen: true,
      openTime: '08:00',
      closeTime: '21:00',
    }));
  }

  private normalizeOpeningHours(
    openingHours?: LibraryOpeningHour[]
  ): LibraryOpeningHour[] {
    const defaults = this.createDefaultOpeningHours();

    for (const item of openingHours || []) {
      const index = defaults.findIndex((d) => d.day === item.day);
      if (index === -1) continue;

      defaults[index] = {
        day: item.day,
        isOpen: typeof item.isOpen === 'boolean' ? item.isOpen : defaults[index].isOpen,
        openTime: item.openTime || defaults[index].openTime,
        closeTime: item.closeTime || defaults[index].closeTime,
      };
    }

    return defaults;
  }

  private normalizeSlots(slots?: number): number {
    const value = Number(slots ?? 30);
    return this.slotOptions.includes(value) ? value : 30;
  }

  private validateOpeningHoursInput(openingHours: LibraryOpeningHour[]): string | null {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const day of openingHours) {
      if (!day.isOpen) continue;

      if (!timeRegex.test(day.openTime) || !timeRegex.test(day.closeTime)) {
        return `Invalid time format for ${this.getDayLabel(day.day)}. Use HH:mm`;
      }

      if (this.timeToMinutes(day.closeTime) <= this.timeToMinutes(day.openTime)) {
        return `Close time must be later than open time on ${this.getDayLabel(day.day)}`;
      }
    }

    return null;
  }

  private findLibraryByName(name: string): LibraryPoint | null {
    return this.findLibraryByNameFromList(name, this.libraries);
  }

  private findLibraryByNameFromList(name: string, libraries: LibraryPoint[]): LibraryPoint | null {
    const target = (name || '').trim().toLowerCase();

    return (
      libraries.find(
        (library) => (library.name || '').trim().toLowerCase() === target
      ) || null
    );
  }

  private createFallbackLibrary(name: string): LibraryPoint {
    return {
      id: '',
      name: name || 'Library',
      lat: 0,
      lng: 0,
      openingHours: this.createDefaultOpeningHours(),
      slots: 30,
    };
  }

  private getDayConfigForDate(
    library: LibraryPoint | null,
    date: Date
  ): LibraryOpeningHour | null {
    if (!library) return null;

    const dayKey = JS_DAY_TO_LIBRARY_DAY[date.getDay()];
    return library.openingHours.find((item) => item.day === dayKey) || null;
  }

  private validateReservationAgainstLibraryRules(
    start: Date,
    end: Date,
    library: LibraryPoint | null
  ): string | null {
    if (!library) {
      return null;
    }

    if (!this.isSameDay(start, end)) {
      return 'Reservation start and end must be on the same day';
    }

    const dayConfig = this.getDayConfigForDate(library, start);

    if (!dayConfig || !dayConfig.isOpen) {
      return `The library is closed on ${this.getDayLabel(JS_DAY_TO_LIBRARY_DAY[start.getDay()])}`;
    }

    const openDate = this.withTime(start, dayConfig.openTime);
    const closeDate = this.withTime(start, dayConfig.closeTime);

    if (start < openDate || end > closeDate) {
      return `Reservation must be within the library opening hours (${dayConfig.openTime} - ${dayConfig.closeTime})`;
    }

    if (!this.isAlignedToSlot(start, library.slots) || !this.isAlignedToSlot(end, library.slots)) {
      return `Reservation times must match ${library.slots}-minute slots`;
    }

    return null;
  }

  private withTime(baseDate: Date, hhmm: string): Date {
    const [hours, minutes] = hhmm.split(':').map(Number);
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private isAlignedToSlot(date: Date, slotMinutes: number): boolean {
    return (
      date.getSeconds() === 0 &&
      date.getMilliseconds() === 0 &&
      date.getMinutes() % slotMinutes === 0
    );
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
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

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private refreshMapSizeSoon(): void {
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 0);
  }
}