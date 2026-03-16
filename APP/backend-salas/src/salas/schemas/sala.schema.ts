import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SalaDocument = Sala & Document;

@Schema()
export class Sala {
  @Prop({ required: true })
  facultad: string;

  @Prop({ required: true })
  numeroSala: number;

  @Prop({ default: 0 })
  personasDentro: number;

  @Prop({ default: 0 })
  ruidoDb: number;

  @Prop()
  horaEntrada?: Date;

  @Prop()
  horaSalida?: Date;

  @Prop()
  ultimoReservadoPor?: string;

  @Prop()
  ultimoReservadoPorId?: string;
}

export const SalaSchema = SchemaFactory.createForClass(Sala);