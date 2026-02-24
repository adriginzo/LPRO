import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import salasRoutes from './routes/salas.js';

const app = express();
app.use(cors());
app.use(express.json());

// URI de MongoDB directamente
const mongoUri = 'mongodb://localhost:27017/salasdb'; // Cambia 'salasdb' si quieres

// Conexión a MongoDB sin opciones obsoletas
mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ Error al conectar con MongoDB:', err);
    process.exit(1);
  });

// RAIZ DEL BACKEND
app.use('/salas', salasRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));