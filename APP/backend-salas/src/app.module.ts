import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalasModule } from './salas/salas.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/salasdb'),
    SalasModule,
  ],
})
export class AppModule {}