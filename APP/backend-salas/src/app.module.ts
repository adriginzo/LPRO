import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalasModule } from './salas/salas.module';
import { ReservasModule } from './reservas/reservas.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/salasdb'),
    SalasModule,
    ReservasModule,
  ],
})
export class AppModule {}