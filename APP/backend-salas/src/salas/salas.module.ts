import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalasService } from './salas.service';
import { SalasController } from './salas.controller';
import { Sala, SalaSchema } from './schemas/sala.schema';
import { Reserva, ReservaSchema } from '../reservas/schemas/reserva.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sala.name, schema: SalaSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
  ],
  controllers: [SalasController],
  providers: [SalasService],
})
export class SalasModule {}