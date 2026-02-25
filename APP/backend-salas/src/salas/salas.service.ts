import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sala, SalaDocument } from './schemas/sala.schema';

@Injectable()
export class SalasService {
  constructor(@InjectModel(Sala.name) private salaModel: Model<SalaDocument>) {}

  async findAll(): Promise<Sala[]> {
    return this.salaModel.find().exec();
  }

  async findOne(id: string): Promise<Sala> {
    const sala = await this.salaModel.findById(id).exec();
    if (!sala) throw new NotFoundException('Sala no encontrada');
    return sala;
  }

  async create(salaData: Partial<Sala>): Promise<Sala> {
    const nuevaSala = new this.salaModel(salaData);
    return nuevaSala.save();
  }

  async updatePersonas(id: string, personasDentro: number): Promise<Sala> {
    const sala = await this.salaModel.findByIdAndUpdate(id, { personasDentro }, { new: true });
    if (!sala) throw new NotFoundException('Sala no encontrada');
    return sala;
  }

  async update(id: string, salaData: Partial<Sala>): Promise<Sala> {
    const sala = await this.salaModel.findByIdAndUpdate(id, salaData, { new: true });
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
}