import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

// Import routes with error handling
let stock, channel, mp3, ip, video, velin, auth, cobalt, home, img;
let initializeSocket = () => {}; // Default no-op function

try {
    const stockModule = await import('./stock.js');
    stock = stockModule.default;
    initializeSocket = stockModule.initializeSocket || (() => {});
} catch (error) {
    console.warn('Could not load stock.js:', error.message);
    stock = (req, res, next) => next();
}

try {
    channel = (await import('./channel.js')).default;
} catch (error) {
    console.warn('Could not load channel.js:', error.message);
    channel = (req, res, next) => next();
}

try {
    mp3 = (await import('./mp3.js')).default;
} catch (error) {
    console.warn('Could not load mp3.js:', error.message);
    mp3 = (req, res, next) => next();
}

try {
    ip = (await import('./ips.js')).default;
} catch (error) {
    console.warn('Could not load ips.js:', error.message);
    ip = (req, res, next) => next();
}

try {
    video = (await import('./video.js')).default;
} catch (error) {
    console.warn('Could not load video.js:', error.message);
    video = (req, res, next) => next();
}

try {
    velin = (await import('./velin.js')).default;
} catch (error) {
    console.warn('Could not load velin.js:', error.message);
    velin = (req, res, next) => next();
}

try {
    auth = (await import('./auth.js')).default;
} catch (error) {
    console.warn('Could not load auth.js:', error.message);
    auth = (req, res, next) => next();
}

try {
    cobalt = (await import('./cobalt.js')).default;
} catch (error) {
    console.warn('Could not load cobalt.js:', error.message);
    cobalt = (req, res, next) => next();
}

try {
    home = (await import('./home.js')).default;
} catch (error) {
    console.warn('Could not load home.js:', error.message);
    home = (req, res, next) => next();
}

try {
    img = (await import('./img.js')).default;
} catch (error) {
    console.warn('Could not load img.js:', error.message);
    img = (req, res, next) => next();
}

const app = express();

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint for Hugging Face Spaces
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files from 'public' directory (with error handling)
const publicPath = path.join(__dirname, '../public');
try {
    app.use(express.static(publicPath));
} catch (error) {
    console.warn('Could not serve static files from public directory:', error.message);
}

// Serve index.html at root route (with error handling)
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, '../public/index.html');
        res.sendFile(indexPath, (err) => {
            if (err) {
                console.warn('Could not serve index.html:', err.message);
                res.status(200).json({ 
                    message: 'API Server is running',
                    endpoints: ['/health', '/api/*'],
                    timestamp: new Date().toISOString()
                });
            }
        });
    } catch (error) {
        res.status(200).json({ 
            message: 'API Server is running',
            endpoints: ['/health', '/api/*'],
            timestamp: new Date().toISOString()
        });
    }
});

// Initialize routes with error handling
try {
    app.use(stock);
    app.use(channel);
    app.use(mp3);
    app.use(ip);
    app.use(video);
    app.use(velin);
    app.use(auth);
    app.use(cobalt);
    app.use(home);
    app.use(img);
} catch (error) {
    console.error('Error initializing routes:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Initialize Socket.IO with error handling
try {
    initializeSocket(server);
} catch (error) {
    console.warn('Could not initialize Socket.IO:', error.message);
}

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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const PORT = process.env.PORT || 7860;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📊 Health check available at http://${HOST}:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Log server startup
console.log('Starting server...');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Platform: Hugging Face Spaces detected: ${process.env.SPACE_ID ? 'Yes' : 'No'}`);
