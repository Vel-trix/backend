const express = require('express');
const axios = require('axios');

const app = express();

// Configure CORS for SSE
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Store connected SSE clients
const clients = new Set();

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

// SSE endpoint for real-time updates
app.get('/stream', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial data
    const data = await fetchStockData();
    if (data) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Add client to list
    const client = res;
    clients.add(client);

    // Remove client when connection closes
    req.on('close', () => {
        clients.delete(client);
    });
});

// Function to broadcast data to all connected clients
function broadcast(data) {
    clients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            console.error('Broadcast error:', error.message);
            clients.delete(client);
        }
    });
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

// Start backend processes if not on Vercel
if (!process.env.VERCEL) {
    // Keep Render backend alive with 30-second ping
    setInterval(pingRenderBackend, 30000);

    // Poll for data updates
    setInterval(async () => {
        const data = await fetchStockData();
        if (data && clients.size > 0) {
            broadcast(data);
        }
    }, 1000);
}

module.exports = app;
