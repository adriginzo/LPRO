import { Controller, Get, Post, Put, Patch, Delete, Param, Body } from '@nestjs/common';
import { SalasService } from './salas.service';
import { Sala } from './schemas/sala.schema';

@Controller('salas')
export class SalasController {
  constructor(private readonly salasService: SalasService) {}

  @Get()
  findAll(): Promise<Sala[]> {
    return this.salasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Sala> {
    return this.salasService.findOne(id);
  }

  @Post()
  create(@Body() salaData: Partial<Sala>): Promise<Sala> {
    return this.salasService.create(salaData);
  }

  @Patch(':id/personas')
  updatePersonas(@Param('id') id: string, @Body('personasDentro') personasDentro: number): Promise<Sala> {
    return this.salasService.updatePersonas(id, personasDentro);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() salaData: Partial<Sala>): Promise<Sala> {
    return this.salasService.update(id, salaData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.salasService.remove(id);
  }

  @Delete()
  removeAll(): Promise<void> {
    return this.salasService.removeAll();
  }
}