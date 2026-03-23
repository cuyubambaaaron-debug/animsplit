require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/projects', require('./routes/projects'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/download', require('./routes/download'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'animsplit-api', version: '1.0.0' });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`AnimSplit API running on port ${PORT}`);
  });
}

start().catch(console.error);
