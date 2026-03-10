import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Library, LibraryDocument } from './schemas/library.schema';
import { UpdateLibraryDto } from './dto/update-library.dto';

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

  async create(library: Library): Promise<Library> {
    const newLibrary = new this.libraryModel(library);
    return newLibrary.save();
  }

  async update(id: string, data: UpdateLibraryDto): Promise<Library> {
    const updated = await this.libraryModel
      .findByIdAndUpdate(id, data, { new: true, runValidators: true })
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
}