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

  async findByFacultad(facultad: string): Promise<Sala[]> {
    const now = new Date();

    // 1. Buscamos todas las salas de la facultad
    const salas = await this.salaModel.find({ facultad }).lean().exec();

    if (!salas || salas.length === 0) {
      throw new NotFoundException(`No se encontraron salas para la facultad: ${facultad}`);
    }

    // 2. Obtenemos los IDs como strings para buscar sus reservas de una sola vez
    const salaIds = salas.map(s => String(s._id));

    // 3. Buscamos las reservas activas que pertenezcan a ESTAS salas
    const activeReservations = await this.reservaModel
      .find({
        salaId: { $in: salaIds },
        horaEntrada: { $lte: now },
        horaSalida: { $gt: now },
      })
      .lean()
      .exec();

    // 4. Creamos un mapa para asignar rápidamente la reserva a su sala
    const activeBySalaId = new Map(
      activeReservations.map((r: any) => [String(r.salaId), r]),
    );

    // 5. Devolvemos todas las salas (tengan o no reserva)
    return salas.map((sala: any) =>
      this.withCurrentReservation(sala, activeBySalaId.get(String(sala._id))),
    ) as Sala[];
  }

  async findByFacultadAndNumero(facultad: string, numeroSala: number): Promise<Sala> {
  const now = new Date();

  // 1. Buscamos la sala específica por facultad Y número
  const sala = await this.salaModel
    .findOne({ facultad, numeroSala })
    .lean()
    .exec();

  if (!sala) {
    throw new NotFoundException(
      `No se encontró la sala ${numeroSala} en la facultad ${facultad}`
    );
  }
  

  // 2. Buscamos si tiene una reserva activa en este momento
  const activeReservation = await this.reservaModel
    .findOne({
      salaId: String(sala._id),
      horaEntrada: { $lte: now },
      horaSalida: { $gt: now },
    })
    .lean()
    .exec();

  // 3. Devolvemos la sala con su reserva (si existe)
  return this.withCurrentReservation(sala, activeReservation);
}

async updateMetricsByFacultadAndNumero(
  facultad: string, 
  numeroSala: number, 
  metrics: { ruidoDb?: number; alert?: number }
): Promise<Sala> {
  // Extraemos solo los campos permitidos para asegurar que no se toque lo demás
  const { ruidoDb, alert } = metrics;

  const sala = await this.salaModel
    .findOneAndUpdate(
      { facultad, numeroSala },
      { $set: { ruidoDb, alert } },
      { new: true } // Para que devuelva la sala ya actualizada
    )
    .lean()
    .exec();

  if (!sala) {
    throw new NotFoundException(
      `No se pudo actualizar: Sala ${numeroSala} no encontrada en ${facultad}`
    );
  }
  return sala as Sala;
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

  async updateDB(id: string, ruidoDb: number): Promise<Sala> {
    const sala = await this.salaModel.findByIdAndUpdate(
      id,
      { ruidoDb },
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