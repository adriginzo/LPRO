const mongoose = require('mongoose');

const SalaSchema = new mongoose.Schema({
  numeroSala: {
    type: Number,
    required: true,
    unique: true
  },

  personasDentro: {
    type: Number,
    required: true,
    min: 0
  },

  ruidoDb: {
    type: Number,
    required: true,
    min: 0
  },

  horaEntrada: {
    type: Date,
    required: true
  },

  horaSalida: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sala', SalaSchema);
