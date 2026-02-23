import mongoose from 'mongoose';

const SalaSchema = new mongoose.Schema({
  numeroSala: { type: Number, required: true },
  personasDentro: { type: Number, required: true },
  ruidoDb: { type: Number, required: true },
  horaEntrada: { type: Date, required: true },
  horaSalida: { type: Date },
});

export default mongoose.model('Sala', SalaSchema);