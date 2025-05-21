import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import stock from './stock.js';
import channel from './channel.js';
import mp3 from './mp3.js';
import ip from './ips.js';
import video from './video.js';
import velin from './velin.js';
import auth from './auth.js'
import cobalt from './cobalt.js';
import home from './home.js';

const app = express();
const PORT = 3100;

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update CORS to allow all hosts
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/', stock);
app.use('/', channel);
app.use('/', mp3);
app.use('/', ip);
app.use('/', video);
app.use('/', velin);
app.use('/', auth)
app.use('/', cobalt)
app.use('/', home);

// Serve index.html for the root route
app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.options('*', cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}/`);
  console.log(`MCX data endpoint: http://localhost:${PORT}/data`);
  console.log(`MP3 download endpoint: http://localhost:${PORT}/mp3/{videoId}`);
  console.log(`MP3 download endpoint: http://localhost:${PORT}/video/{videoId}`);
  console.log(`Channel videos endpoint: http://localhost:${PORT}/c/{channelId}`);
});