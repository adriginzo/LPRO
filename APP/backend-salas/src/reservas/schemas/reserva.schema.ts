import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReservaDocument = Reserva & Document;

@Schema({ timestamps: true })
export class Reserva {
  @Prop({ required: true, index: true })
  salaId: string;

  @Prop({ required: true })
  facultad: string;

  @Prop({ required: true })
  numeroSala: number;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true, index: true })
  horaEntrada: Date;

  @Prop({ required: true, index: true })
  horaSalida: Date;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

ReservaSchema.index({ salaId: 1, horaEntrada: 1, horaSalida: 1 });
ReservaSchema.index({ userId: 1, horaSalida: 1 });
