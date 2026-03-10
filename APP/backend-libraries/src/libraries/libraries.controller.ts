import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { LibrariesService } from './libraries.service';
import { Library } from './schemas/library.schema';
import { UpdateLibraryDto } from './dto/update-library.dto';

@Controller('libraries')
export class LibrariesController {
  constructor(private readonly librariesService: LibrariesService) {}

  @Get()
  findAll() {
    return this.librariesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.librariesService.findOne(id);
  }

  @Post()
  create(@Body() library: Library) {
    return this.librariesService.create(library);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateLibraryDto) {
    return this.librariesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.librariesService.remove(id);
  }
}