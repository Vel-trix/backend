import express from 'express';
import axios from 'axios';
import { Server } from 'socket.io';

const app = express();
let io;

// Function to fetch data from the source
async function fetchStockData() {
    try {
        const headers = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'Connection': 'keep-alive',
            'Host': '88.99.61.159:4000',
            'If-None-Match': 'W/"3b80-5FY+gUMGy2CzPm8HBz2ejQ"',
            'Origin': 'http://88.99.61.159:5000',
            'Referer': 'http://88.99.61.159:5000/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
        };

        const response = await axios.get('http://88.99.61.159:4000/getdata', {
            headers,
            timeout: 5000,
            validateStatus: (status) => status === 200
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching stock data:', error.message);
        return null;
    }
}

// Internal ping function to keep Render backend alive
async function pingRenderBackend() {
    try {
        const response = await axios.get('https://backend-nl8q.onrender.com/', {
            timeout: 5000,
            validateStatus: (status) => status === 200
        });
        console.log('Render backend ping successful:', new Date().toISOString());
        return true;
    } catch (error) {
        console.error('Render backend ping error:', error.message);
        return false;
    }
}

// Initialize Socket.IO
export function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "OPTIONS"],
            credentials: true,
            allowedHeaders: ["Content-Type"]
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        
        // Send initial data
        fetchStockData().then(data => {
            if (data) {
                socket.emit('stockData', data);
            }
        }).catch(error => {
            console.error('Error fetching initial data:', error);
            socket.emit('error', { message: 'Failed to fetch initial data' });
        });

        socket.on('disconnect', (reason) => {
            console.log(`Client disconnected (${socket.id}):`, reason);
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    // Start data polling if not on Vercel
    if (!process.env.VERCEL) {
        // Keep Render backend alive with 30-second ping
        const pingInterval = setInterval(async () => {
            try {
                await pingRenderBackend();
            } catch (error) {
                console.error('Ping error:', error);
            }
        }, 30000);

        // Poll for data updates
        const dataInterval = setInterval(async () => {
            try {
                const data = await fetchStockData();
                if (data && io.sockets.sockets.size > 0) {
                    io.emit('stockData', data);
                }
            } catch (error) {
                console.error('Data fetch error:', error);
                io.emit('error', { message: 'Failed to fetch stock data' });
            }
        }, 1000);

        // Cleanup on process exit
        process.on('SIGTERM', () => {
            clearInterval(pingInterval);
            clearInterval(dataInterval);
            io.close();
        });
    }
}

// REST endpoint for initial data fetch
app.get('/data', async (req, res) => {
    try {
        const data = await fetchStockData();
        if (!data) {
            throw new Error('Failed to fetch data');
        }
        res.json(data);
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({
            error: 'Failed to fetch data',
            details: error.message
        });
    }
});

export default app;