import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LibraryDocument = Library & Document;

export type LibraryDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

@Schema({ _id: false })
export class LibraryOpeningHour {
  @Prop({
    required: true,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  })
  day: LibraryDay;

  @Prop({ required: true, default: true })
  isOpen: boolean;

  @Prop({
    required: true,
    default: '08:00',
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,
  })
  openTime: string;

  @Prop({
    required: true,
    default: '21:00',
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,
  })
  closeTime: string;
}

export const LibraryOpeningHourSchema =
  SchemaFactory.createForClass(LibraryOpeningHour);

function buildDefaultOpeningHours(): LibraryOpeningHour[] {
  return [
    { day: 'monday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    { day: 'tuesday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    { day: 'wednesday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    { day: 'thursday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    { day: 'friday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    { day: 'saturday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    { day: 'sunday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
  ];
}

@Schema()
export class Library {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;

  @Prop({
    type: [LibraryOpeningHourSchema],
    default: buildDefaultOpeningHours,
  })
  openingHours: LibraryOpeningHour[];

  @Prop({
    required: true,
    enum: [5, 10, 15, 25, 30, 60],
    default: 30,
  })
  slots: number;
}

export const LibrarySchema = SchemaFactory.createForClass(Library);