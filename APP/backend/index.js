const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/meanapp')
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error(err));

app.get('/', (req, res) => {
  res.send('API funcionando');
});

app.listen(3000, () => {
  console.log('Servidor en http://localhost:3000');
});
