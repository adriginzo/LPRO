import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { Reserva, ReservaSchema } from './schemas/reserva.schema';
import { Sala, SalaSchema } from '../salas/schemas/sala.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reserva.name, schema: ReservaSchema },
      { name: Sala.name, schema: SalaSchema },
    ]),
  ],
  controllers: [ReservasController],
  providers: [ReservasService],
})
export class ReservasModule {}
