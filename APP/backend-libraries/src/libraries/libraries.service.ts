import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Library,
  LibraryDay,
  LibraryDocument,
  LibraryOpeningHour,
} from './schemas/library.schema';
import { UpdateLibraryDto } from './dto/update-library.dto';

const DAY_ORDER: LibraryDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const SLOT_OPTIONS = [5, 10, 15, 25, 30, 60] as const;

@Injectable()
export class LibrariesService {
  constructor(
    @InjectModel(Library.name) private libraryModel: Model<LibraryDocument>,
  ) {}

  async findAll(): Promise<Library[]> {
    return this.libraryModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<Library> {
    const library = await this.libraryModel.findById(id).exec();
    if (!library) {
      throw new NotFoundException('Library not found');
    }
    return library;
  }

  async findByName(name: string): Promise<Library> {
    const trimmed = (name || '').trim();

    if (!trimmed) {
      throw new BadRequestException('Library name is required');
    }

    const library = await this.libraryModel
      .findOne({
        name: {
          $regex: new RegExp(`^${this.escapeRegex(trimmed)}$`, 'i'),
        },
      })
      .exec();

    if (!library) {
      throw new NotFoundException('Library not found');
    }

    return library;
  }

  async create(library: Library): Promise<Library> {
    const openingHours = this.normalizeOpeningHours(library?.openingHours);
    const slots = this.normalizeSlots(library?.slots);

    this.validateOpeningHours(openingHours);

    const newLibrary = new this.libraryModel({
      ...library,
      name: (library?.name || '').trim(),
      openingHours,
      slots,
    });

    return newLibrary.save();
  }

  async update(id: string, data: UpdateLibraryDto): Promise<Library> {
    const payload: UpdateLibraryDto = { ...data };

    if (typeof payload.name === 'string') {
      payload.name = payload.name.trim();
    }

    if (payload.openingHours) {
      payload.openingHours = this.normalizeOpeningHours(payload.openingHours);
      this.validateOpeningHours(payload.openingHours as LibraryOpeningHour[]);
    }

    if (payload.slots !== undefined) {
      payload.slots = this.normalizeSlots(payload.slots);
    }

    const updated = await this.libraryModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Library not found');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.libraryModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException('Library not found');
    }
  }

  private normalizeOpeningHours(
    openingHours?: Partial<LibraryOpeningHour>[],
  ): LibraryOpeningHour[] {
    const defaults: Record<LibraryDay, LibraryOpeningHour> = {
      monday: { day: 'monday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      tuesday: { day: 'tuesday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      wednesday: { day: 'wednesday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      thursday: { day: 'thursday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      friday: { day: 'friday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      saturday: { day: 'saturday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
      sunday: { day: 'sunday', isOpen: true, openTime: '08:00', closeTime: '21:00' },
    };

    for (const item of openingHours || []) {
      const day = item?.day as LibraryDay | undefined;
      if (!day || !DAY_ORDER.includes(day)) continue;

      defaults[day] = {
        day,
        isOpen: typeof item.isOpen === 'boolean' ? item.isOpen : defaults[day].isOpen,
        openTime:
          typeof item.openTime === 'string' && item.openTime.trim()
            ? item.openTime.trim()
            : defaults[day].openTime,
        closeTime:
          typeof item.closeTime === 'string' && item.closeTime.trim()
            ? item.closeTime.trim()
            : defaults[day].closeTime,
      };
    }

    return DAY_ORDER.map((day) => defaults[day]);
  }

  private validateOpeningHours(openingHours: LibraryOpeningHour[]): void {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const dayConfig of openingHours) {
      if (!timeRegex.test(dayConfig.openTime) || !timeRegex.test(dayConfig.closeTime)) {
        throw new BadRequestException(
          `Invalid time format in ${dayConfig.day}. Use HH:mm`,
        );
      }

      if (!dayConfig.isOpen) continue;

      if (this.timeToMinutes(dayConfig.closeTime) <= this.timeToMinutes(dayConfig.openTime)) {
        throw new BadRequestException(
          `Close time must be later than open time in ${dayConfig.day}`,
        );
      }
    }
  }

  private normalizeSlots(slots?: number): number {
    const value = Number(slots);

    if (!SLOT_OPTIONS.includes(value as any)) {
      throw new BadRequestException(
        'Invalid slot size. Allowed values: 5, 10, 15, 25, 30 or 60 minutes',
      );
    }

    return value;
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}