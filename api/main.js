import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import stock, { initializeSocket } from './stock.js';
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

// Create HTTP server
const server = createServer(app);

// Update CORS to allow all hosts
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize routes
app.use(stock);
app.use(channel);
app.use(mp3);
app.use(ip);
app.use(video);
app.use(velin);
app.use(auth);
app.use(cobalt);
app.use(home);

// Initialize Socket.IO
initializeSocket(server);

// Handle graceful shutdown
const shutdown = () => {
    console.log('\nGracefully shutting down...');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('WebSocket server enabled');
    console.log('Frontend: http://localhost:' + PORT + '/');
    console.log('MCX data endpoint: http://localhost:' + PORT + '/data');
    console.log('MP3 download endpoint: http://localhost:' + PORT + '/mp3/{videoId}');
    console.log('MP3 download endpoint: http://localhost:' + PORT + '/video/{videoId}');
    console.log('Channel videos endpoint: http://localhost:' + PORT + '/c/{channelId}');
});