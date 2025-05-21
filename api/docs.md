# Stock Data API Documentation

This API provides real-time stock data through both REST and Server-Sent Events (SSE) endpoints.

## Base URL
```
https://backendmix.vercel.app
```

## REST API

### GET /data
Returns the current stock data.

#### Example Request
```javascript
fetch('https://backendmix.vercel.app/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

## Server-Sent Events (SSE) API

The SSE API provides real-time updates whenever the stock data changes (checked every second).

### Endpoint: /stream

```javascript
const eventSource = new EventSource('https://backendmix.vercel.app/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New stock data:', data);
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

## Example Implementation (React)

```javascript
import { useEffect, useState } from 'react';

function StockData() {
  const [stockData, setStockData] = useState(null);

  useEffect(() => {
    // Initial data fetch
    fetch('https://backendmix.vercel.app/data')
      .then(res => res.json())
      .then(data => setStockData(data))
      .catch(err => console.error('Error fetching initial data:', err));

    // Set up SSE connection
    const eventSource = new EventSource('https://backendmix.vercel.app/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStockData(data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // Optionally implement reconnection logic here
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
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

## Error Handling

- If the SSE connection is lost, the client will automatically attempt to reconnect
- The REST API returns appropriate HTTP status codes:
  - 200: Success
  - 500: Server Error

## Notes

- Data is polled from the source every second
- Updates are sent through SSE when data changes
- SSE provides a reliable way to receive real-time updates and works well with serverless deployments
- Use the REST API for initial data load or one-time queries
- The SSE connection will automatically reconnect if disconnected
- No need to install additional client libraries (unlike WebSocket)
