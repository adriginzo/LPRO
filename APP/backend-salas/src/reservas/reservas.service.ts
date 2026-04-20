import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva, ReservaDocument } from './schemas/reserva.schema';
import { Sala, SalaDocument } from '../salas/schemas/sala.schema';

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

const SLOT_OPTIONS = [5, 10, 15, 25, 30, 60] as const;

@Injectable()
export class ReservasService {
  private readonly MAX_RESERVATION_MS = 3 * 60 * 60 * 1000;
  private readonly PAST_TOLERANCE_MS = 60 * 1000;
  private readonly librariesApiUrl = 'http://100.80.240.31:3002/libraries';

  constructor(
    @InjectModel(Reserva.name) private reservaModel: Model<ReservaDocument>,
    @InjectModel(Sala.name) private salaModel: Model<SalaDocument>,
  ) {}

  async findAll(): Promise<Reserva[]> {
    return this.reservaModel.find().sort({ horaEntrada: 1 }).exec();
  }

  async findUserUpcoming(userId: string): Promise<Reserva[]> {
    return this.reservaModel
      .find({
        userId,
        horaSalida: { $gt: new Date() },
      })
      .sort({ horaEntrada: 1 })
      .exec();
  }

  async create(reservaData: Partial<Reserva>): Promise<Reserva> {
    const salaId = (reservaData.salaId || '').trim();
    const userId = (reservaData.userId || '').trim();
    const userName = (reservaData.userName || '').trim();

    if (
      !salaId ||
      !userId ||
      !userName ||
      !reservaData.horaEntrada ||
      !reservaData.horaSalida
    ) {
      throw new BadRequestException('Missing required reservation data');
    }

    const sala = await this.salaModel.findById(salaId).exec();
    if (!sala) {
      throw new NotFoundException('Sala no encontrada');
    }

    const start = new Date(reservaData.horaEntrada as any);
    const end = new Date(reservaData.horaSalida as any);

    this.validateWindow(start, end, false);

    const library = await this.findLibraryByName(sala.facultad);
    this.validateLibraryRules(start, end, library);

    await this.ensureUserHasNoOtherReservation(userId);
    await this.ensureSalaWindowIsFree(salaId, start, end);

    const reserva = new this.reservaModel({
      salaId,
      facultad: sala.facultad,
      numeroSala: sala.numeroSala,
      userId,
      userName,
      horaEntrada: start,
      horaSalida: end,
    });

    return reserva.save();
  }

  async update(id: string, reservaData: Partial<Reserva>): Promise<Reserva> {
    const reserva = await this.reservaModel.findById(id).exec();
    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reservaData.userId && reservaData.userId !== reserva.userId) {
      throw new BadRequestException('You can only modify your own reservation');
    }

    const start = reservaData.horaEntrada
      ? new Date(reservaData.horaEntrada as any)
      : new Date(reserva.horaEntrada as any);

    const end = reservaData.horaSalida
      ? new Date(reservaData.horaSalida as any)
      : new Date(reserva.horaSalida as any);

    this.validateWindow(start, end, true);

    const library = await this.findLibraryByName(reserva.facultad);
    this.validateLibraryRules(start, end, library);

    await this.ensureUserHasNoOtherReservation(reserva.userId, id);
    await this.ensureSalaWindowIsFree(reserva.salaId, start, end, id);

    reserva.horaEntrada = start;
    reserva.horaSalida = end;

    return reserva.save();
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.reservaModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Reserva no encontrada');
    }
  }

  private validateWindow(
    start: Date,
    end: Date,
    allowPastStart: boolean,
  ): void {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('Exit time must be later than entry time');
    }

    if (end.getTime() - start.getTime() > this.MAX_RESERVATION_MS) {
      throw new BadRequestException('The maximum reservation time is 3 hours');
    }

    if (!allowPastStart && start.getTime() < Date.now() - this.PAST_TOLERANCE_MS) {
      throw new BadRequestException('Entry time cannot be in the past');
    }

    if (end.getTime() <= Date.now()) {
      throw new BadRequestException('Exit time must be in the future');
    }
  }

  private async ensureUserHasNoOtherReservation(
    userId: string,
    excludeReservationId?: string,
  ): Promise<void> {
    const query: any = {
      userId,
      horaSalida: { $gt: new Date() },
    };

    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }

    const existing = await this.reservaModel.findOne(query).exec();

    if (existing) {
      throw new ConflictException(
        'You already have an active or upcoming reservation',
      );
    }
  }

  private async ensureSalaWindowIsFree(
    salaId: string,
    start: Date,
    end: Date,
    excludeReservationId?: string,
  ): Promise<void> {
    const query: any = {
      salaId,
      horaEntrada: { $lt: end },
      horaSalida: { $gt: start },
    };

    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }

    const overlapping = await this.reservaModel.findOne(query).exec();

    if (overlapping) {
      throw new ConflictException(
        'This time window is already reserved by another user',
      );
    }
  }

  private async findLibraryByName(name: string): Promise<LibraryApi> {
    const trimmed = (name || '').trim();

    if (!trimmed) {
      throw new NotFoundException('Library configuration not found for this room');
    }

    const encodedName = encodeURIComponent(trimmed);
    let response: any;

    try {
      response = await fetch(`${this.librariesApiUrl}/by-name/${encodedName}`);
    } catch {
      throw new InternalServerErrorException(
        'Could not validate the reservation against the library configuration',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException('Library configuration not found for this room');
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Could not validate the reservation against the library configuration',
      );
    }

    return (await response.json()) as LibraryApi;
  }

  private validateLibraryRules(
    start: Date,
    end: Date,
    library: LibraryApi,
  ): void {
    if (!this.isSameDay(start, end)) {
      throw new BadRequestException(
        'Reservation start and end must be on the same day',
      );
    }

    const openingHours = this.normalizeOpeningHours(library.openingHours);
    const dayKey = JS_DAY_TO_LIBRARY_DAY[start.getDay()];
    const dayConfig = openingHours.find((item) => item.day === dayKey);

    if (!dayConfig || !dayConfig.isOpen) {
      throw new BadRequestException(
        `The library is closed on ${this.getDayLabel(dayKey)}`,
      );
    }

    const openDate = this.withTime(start, dayConfig.openTime);
    const closeDate = this.withTime(start, dayConfig.closeTime);

    if (closeDate.getTime() <= openDate.getTime()) {
      throw new InternalServerErrorException(
        'The library opening hours are invalid',
      );
    }

    if (start.getTime() < openDate.getTime() || end.getTime() > closeDate.getTime()) {
      throw new BadRequestException(
        `Reservation must be within the library opening hours (${dayConfig.openTime} - ${dayConfig.closeTime})`,
      );
    }

    const slotMinutes = this.normalizeSlots(library.slots);

    if (!this.isAlignedToSlot(start, slotMinutes) || !this.isAlignedToSlot(end, slotMinutes)) {
      throw new BadRequestException(
        `Reservation times must match ${slotMinutes}-minute slots`,
      );
    }
  }

  private normalizeOpeningHours(
    openingHours?: LibraryOpeningHour[],
  ): LibraryOpeningHour[] {
    const defaults: Record<LibraryDay, LibraryOpeningHour> = {
      monday: { day: 'monday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      tuesday: { day: 'tuesday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      wednesday: { day: 'wednesday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      thursday: { day: 'thursday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      friday: { day: 'friday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      saturday: { day: 'saturday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      sunday: { day: 'sunday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    };

    for (const item of openingHours || []) {
      if (!item?.day || !DAY_ORDER.includes(item.day)) continue;

      defaults[item.day] = {
        day: item.day,
        isOpen: typeof item.isOpen === 'boolean' ? item.isOpen : defaults[item.day].isOpen,
        openTime: item.openTime || defaults[item.day].openTime,
        closeTime: item.closeTime || defaults[item.day].closeTime,
      };
    }

    return DAY_ORDER.map((day) => defaults[day]);
  }

  private normalizeSlots(slots?: number): number {
    const value = Number(slots ?? 30);

    if (!SLOT_OPTIONS.includes(value as any)) {
      return 30;
    }

    return value;
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

  private getDayLabel(day: LibraryDay): string {
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
}