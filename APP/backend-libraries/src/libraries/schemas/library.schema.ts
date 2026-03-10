import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LibraryDocument = Library & Document;

@Schema()
export class Library {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;
}

export const LibrarySchema = SchemaFactory.createForClass(Library);