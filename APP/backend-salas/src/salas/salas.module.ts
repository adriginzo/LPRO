import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalasService } from './salas.service';
import { SalasController } from './salas.controller';
import { Sala, SalaSchema } from './schemas/sala.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Sala.name, schema: SalaSchema }])],
  controllers: [SalasController],
  providers: [SalasService],
})
export class SalasModule {}