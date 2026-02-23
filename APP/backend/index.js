const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 📦 Importar modelo
const Sala = require('./models/Sala');

const app = express();
app.use(cors());
app.use(express.json());

// 🔌 Conectar a MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/meanapp')
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error(err));

// 🧪 Ruta de prueba
app.get('/', (req, res) => {
  res.send('API funcionando');
});

// 📄 Obtener todas las salas
app.get('/salas', async (req, res) => {
  try {
    const salas = await Sala.find();
    res.json(salas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🏫 Crear una nueva sala
app.post('/salas', async (req, res) => {
  try {
    const { numeroSala, personasDentro, ruidoDb, horaEntrada, horaSalida } = req.body;

    // Crear instancia del modelo
    const nuevaSala = new Sala({
      numeroSala,
      personasDentro,
      ruidoDb,
      horaEntrada,
      horaSalida
    });

    // Guardar en MongoDB
    const salaGuardada = await nuevaSala.save();
    res.status(201).json(salaGuardada);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 🚀 Arranque del servidor
app.listen(3000, () => {
  console.log('Servidor en http://localhost:3000');
});