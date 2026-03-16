import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva, ReservaDocument } from './schemas/reserva.schema';
import { Sala, SalaDocument } from '../salas/schemas/sala.schema';

@Injectable()
export class ReservasService {
  private readonly MAX_RESERVATION_MS = 3 * 60 * 60 * 1000;
  private readonly PAST_TOLERANCE_MS = 60 * 1000;

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
    await this.ensureUserHasNoOtherReservation(reserva.userId, id);
    await this.ensureSalaWindowIsFree(reserva.salaId, start, end, id);

    reserva.horaEntrada = start;
    reserva.horaSalida = end;

    return reserva.save();
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
}
