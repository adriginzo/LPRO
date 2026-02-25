import mongoose from 'mongoose';

const UsuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  apellidos: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  dni: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  escuela: {
    type: String,
    required: true,
    trim: true
  },
  carrera: {
    type: String,
    required: true,
    trim: true
  },
  telefono: {
    type: String,
    required: true,
    trim: true
  }
});

export default mongoose.model('Usuario', UsuarioSchema);