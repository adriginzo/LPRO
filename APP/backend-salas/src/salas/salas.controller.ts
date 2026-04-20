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

  @Get('facultad/:facultad')
  findByFacultad(@Param('facultad') facultad: string): Promise<Sala[]> {
    return this.salasService.findByFacultad(facultad);
  }

  @Get('facultad/:facultad/numeroSala/:numeroSala')
  findByFacultadAndNumero(
    @Param('facultad') facultad: string,
    @Param('numeroSala') numeroSala: string,
  ): Promise<Sala> {
    return this.salasService.findByFacultadAndNumero(facultad, Number(numeroSala));
  }

  @Patch('facultad/:facultad/numeroSala/:numeroSala')
  async updateMetrics(
    @Param('facultad') facultad: string,
    @Param('numeroSala') numeroSala: string,
    @Body() metrics: { ruidoDb?: number; alert?: number; personasDentro?: number },
  ) {
    return this.salasService.updateMetricsByFacultadAndNumero(
      facultad,
      Number(numeroSala),
      metrics,
    );
  }

  @Post()
  create(@Body() salaData: Partial<Sala>): Promise<Sala> {
    return this.salasService.create(salaData);
  }

  @Patch(':id/personas')
  updatePersonas(@Param('id') id: string, @Body('personasDentro') personasDentro: number): Promise<Sala> {
    return this.salasService.updatePersonas(id, personasDentro);
  }

  @Patch(':id/decibelios')
  updateDB(@Param('id') id: string, @Body('ruidoDb') ruidoDb: number): Promise<Sala> {
    return this.salasService.updateDB(id, ruidoDb);
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