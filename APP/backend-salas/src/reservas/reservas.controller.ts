import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { Reserva } from './schemas/reserva.schema';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get()
  findAll(): Promise<Reserva[]> {
    return this.reservasService.findAll();
  }

  @Get('user/:userId/upcoming')
  findUserUpcoming(@Param('userId') userId: string): Promise<Reserva[]> {
    return this.reservasService.findUserUpcoming(userId);
  }

  @Post()
  create(@Body() reservaData: Partial<Reserva>): Promise<Reserva> {
    return this.reservasService.create(reservaData);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() reservaData: Partial<Reserva>,
  ): Promise<Reserva> {
    return this.reservasService.update(id, reservaData);
  }
}
