require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);   // detrás del proxy HTTPS del hosting (Render)
const PORT = process.env.PORT || 3000;
fs.mkdirSync(path.join(__dirname, '../public/uploads'), { recursive: true });

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
// Framework Bootstrap 5 servido desde el propio proyecto (funciona sin internet)
app.use('/vendor/bootstrap', express.static(path.join(__dirname, '../node_modules/bootstrap/dist')));
app.use('/panel', express.static(path.join(__dirname, '../panel')));

app.get('/salud', (req, res) => res.send('ok'));   // comprobación de estado para el hosting
app.use('/api', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'La imagen supera los 3 MB.' });
  res.status(500).json({ error: 'Ocurrió un error en el servidor. Intenta de nuevo.' });
});

app.listen(PORT, () => console.log(`NatyfarmaWeb en http://localhost:${PORT}`));
