import { LibraryDay } from '../schemas/library.schema';

export class UpdateLibraryOpeningHourDto {
  day?: LibraryDay;
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
}

export class UpdateLibraryDto {
  name?: string;
  lat?: number;
  lng?: number;
  openingHours?: UpdateLibraryOpeningHourDto[];
  slots?: number;
}