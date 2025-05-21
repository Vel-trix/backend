// SpotTheFly Scraper API
// This is an Express.js API that scrapes data from SpotTheFly's home.json endpoint using ES modules
// Supports pagination using continuation tokens

import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

// Enable CORS
app.use(cors());

// Home route
app.get('/', (req, res) => {
  res.send('SpotTheFly Scraper API - Use /home to get the scraped data');
});

// Main scraper endpoint
app.get('/home', async (req, res) => {
  try {
    // Extract continuation parameters from request
    const { ctoken, itct, type, visitorData } = req.query;
    
    // Base URL
    let url = 'https://spotthefly.com/api/v1/home.json';
    
    // Add pagination parameters if provided
    if (ctoken && itct) {
      url += `?itct=${encodeURIComponent(itct)}&ctoken=${encodeURIComponent(ctoken)}`;
      
      // Add type parameter if provided
      if (type) {
        url += `&type=${encodeURIComponent(type)}`;
      }
      
      // Add visitorData parameter if provided
      if (visitorData) {
        url += `&visitorData=${encodeURIComponent(visitorData)}`;
      }
    }
    
    // Set up headers to mimic a browser request
    const headers = {
      'authority': 'spotthefly.com',
      'accept': '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': 'https://spotthefly.com/',
      'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
    };

    console.log(`Fetching data from: ${url}`);
    
    // Make the request to the target API
    const response = await axios.get(url, { headers });
    
    // Return the data
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      source: url,
      pagination: {
        hasNext: response.data?.continuationToken ? true : false,
        nextParams: response.data?.continuationToken ? {
          ctoken: response.data.continuationToken,
          itct: response.data.itct || itct,
          type: 'next',
          visitorData: response.data.visitorData || visitorData
        } : null
      },
      data: response.data
    });
  } catch (error) {
    console.error('Error scraping data:', error.message);
    
    // Return error response
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText
      } : null
    });
  }
});


// Export for serverless functions if needed
export default app;