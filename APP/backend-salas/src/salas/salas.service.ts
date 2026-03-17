import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sala, SalaDocument } from './schemas/sala.schema';
import { Reserva, ReservaDocument } from '../reservas/schemas/reserva.schema';

@Injectable()
export class SalasService {
  constructor(
    @InjectModel(Sala.name) private salaModel: Model<SalaDocument>,
    @InjectModel(Reserva.name) private reservaModel: Model<ReservaDocument>,
  ) {}

  async findAll(): Promise<Sala[]> {
    const now = new Date();

    const salas = await this.salaModel.find().lean().exec();
    const activeReservations = await this.reservaModel
      .find({
        horaEntrada: { $lte: now },
        horaSalida: { $gt: now },
      })
      .lean()
      .exec();

    const activeBySalaId = new Map(
      activeReservations.map((r: any) => [String(r.salaId), r]),
    );

    return salas.map((sala: any) =>
      this.withCurrentReservation(sala, activeBySalaId.get(String(sala._id))),
    ) as Sala[];
  }

  async findOne(id: string): Promise<Sala> {
    const now = new Date();

    const sala = await this.salaModel.findById(id).lean().exec();
    if (!sala) throw new NotFoundException('Sala no encontrada');

    const activeReservation = await this.reservaModel
      .findOne({
        salaId: id,
        horaEntrada: { $lte: now },
        horaSalida: { $gt: now },
      })
      .lean()
      .exec();

    return this.withCurrentReservation(sala, activeReservation);
  }

  async create(salaData: Partial<Sala>): Promise<Sala> {
    const nuevaSala = new this.salaModel(salaData);
    return nuevaSala.save();
  }

  async updatePersonas(id: string, personasDentro: number): Promise<Sala> {
    const sala = await this.salaModel.findByIdAndUpdate(
      id,
      { personasDentro },
      { new: true },
    );

    if (!sala) throw new NotFoundException('Sala no encontrada');
    return sala;
  }

  async update(id: string, salaData: Partial<Sala>): Promise<Sala> {
    const sala = await this.salaModel.findByIdAndUpdate(id, salaData, {
      new: true,
    });

    if (!sala) throw new NotFoundException('Sala no encontrada');
    return sala;
  }

  async remove(id: string): Promise<void> {
    const result = await this.salaModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Sala no encontrada');
  }

  async removeAll(): Promise<void> {
    await this.salaModel.deleteMany({});
  }

  private withCurrentReservation(sala: any, reserva?: any): Sala {
    return {
      ...sala,
      horaEntrada: reserva?.horaEntrada,
      horaSalida: reserva?.horaSalida,
      ultimoReservadoPor: reserva?.userName || '',
      ultimoReservadoPorId: reserva?.userId || '',
    } as Sala;
  }
}