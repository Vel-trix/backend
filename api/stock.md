# Stock Data API Documentation

This API provides real-time stock data through both REST and WebSocket (Socket.IO) endpoints.

## Base URL
```
https://backend-nl8q.onrender.com
```

## REST API

### GET /data
Returns the current stock data.

#### Example Request
```javascript
fetch('https://backend-nl8q.onrender.com/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

## WebSocket API (Socket.IO)

The WebSocket API provides real-time updates whenever the stock data changes (checked every second).

### Connection

First, install the Socket.IO client:
```bash
npm install socket.io-client
```

Then connect to the WebSocket:
```javascript
import { io } from 'socket.io-client';

const socket = io('https://backend-nl8q.onrender.com', {
    transports: ['websocket']
});

// Listen for stock data updates
socket.on('stockData', (data) => {
    console.log('New stock data:', data);
});

// Handle connection events
socket.on('connect', () => {
    console.log('Connected to WebSocket');
});

socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket');
});

// Close connection when done
function closeConnection() {
    socket.disconnect();
}
```

## Example Implementation (React)

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function StockData() {
    const [stockData, setStockData] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initial data fetch
        fetch('https://backend-nl8q.onrender.com/data')
            .then(res => res.json())
            .then(data => setStockData(data))
            .catch(err => console.error('Error fetching initial data:', err));

        // Set up WebSocket connection
        const socket = io('https://backend-nl8q.onrender.com', {
            transports: ['websocket']
        });

        socket.on('connect', () => {
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('stockData', (data) => {
            setStockData(data);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    return (
        <div>
            <div>Connection Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
            {stockData ? (
                <pre>{JSON.stringify(stockData, null, 2)}</pre>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
}

export default StockData;
```

## Events

### Server to Client
- `stockData`: Emitted when new stock data is available
  - Frequency: Up to once per second, only when data changes
  - Data Format: Same as REST API response

### Connection Events
- `connect`: Fired when connection is established
- `disconnect`: Fired when connection is lost
- `connect_error`: Fired when connection error occurs

## Technical Details

- The backend polls for new data every second
- Updates are broadcast to all connected clients
- Automatic reconnection is handled by Socket.IO
- The backend pings Render every 30 seconds to keep it alive
- WebSocket provides lower latency than polling

## Error Handling

- Socket.IO automatically handles reconnection
- The REST API returns appropriate HTTP status codes:
  - 200: Success
  - 500: Server Error

## Notes

- Prefer WebSocket for real-time updates
- Use REST API for initial data load or one-time queries
- The connection will automatically reconnect if lost
- Data updates are pushed immediately to all connected clients
