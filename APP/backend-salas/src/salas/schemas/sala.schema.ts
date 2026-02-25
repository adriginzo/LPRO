import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SalaDocument = Sala & Document;

@Schema()
export class Sala {
  @Prop({ required: true })
  numeroSala: number;

  @Prop({ required: true })
  personasDentro: number;

  @Prop({ required: true })
  ruidoDb: number;

  @Prop({ required: true })
  horaEntrada: Date;

  @Prop()
  horaSalida: Date;
}

export const SalaSchema = SchemaFactory.createForClass(Sala);
