// routes/salas.js
import express from 'express';
import Sala from '../models/Sala.js';

const router = express.Router();

// Obtener todas las salas
router.get('/', async (req, res) => {
  try {
    const salas = await Sala.find();
    res.json(salas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /salas/:id - obtener sala por ID
router.get('/:id', async (req, res) => {
  try {
    const sala = await Sala.findById(req.params.id);
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });
    res.json(sala);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear una sala
router.post('/', async (req, res) => {
  try {
    const nuevaSala = new Sala(req.body);
    const salaGuardada = await nuevaSala.save();
    res.json(salaGuardada);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /salas/:id/personas - actualizar solo personasDentro (sensor)
router.patch('/:id/personas', async (req, res) => {
  try {
    const { personasDentro } = req.body;

    // Validación básica
    if (personasDentro === undefined) {
      return res.status(400).json({ error: 'personasDentro es obligatorio' });
    }

    if (typeof personasDentro !== 'number' || personasDentro < 0) {
      return res.status(400).json({ error: 'personasDentro debe ser un número válido' });
    }

    const salaActualizada = await Sala.findByIdAndUpdate(
      req.params.id,
      { personasDentro },
      { new: true }
    );

    if (!salaActualizada) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    res.json(salaActualizada);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Actualizar una sala
router.put('/:id', async (req, res) => {
  try {
    const salaActualizada = await Sala.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(salaActualizada);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar una sala por ID
router.delete('/:id', async (req, res) => {
  try {
    await Sala.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sala eliminada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Eliminar todas las salas
router.delete('/', async (req, res) => {
  try {
    await Sala.deleteMany({});
    res.json({ message: 'Todas las salas eliminadas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;