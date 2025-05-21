import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio'; // Fixed: Use namespace import instead of default import

const app = express();

// Function to scrape proxies from proxyelite.info
async function scrapeProxyElite() {
  try {
    const response = await fetch('https://proxyelite.info/free/asia/india/');
    
    if (!response.ok) {
      throw new Error(`ProxyElite scraping error! Status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const proxies = [];
    
    // Find all table rows
    $('tr').each((index, element) => {
      // Get IP address from cell with class "table-ip"
      const ip = $(element).find('td.table-ip').text().trim();
      
      // Get port from the second td element
      const port = $(element).find('td').eq(1).text().trim();
      
      // If both IP and port are valid, add to proxies list
      if (ip && port && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        proxies.push(`${ip}:${port}`);
      }
    });
    
    return proxies;
  } catch (error) {
    console.error('Error scraping ProxyElite:', error);
    return []; // Return empty array on error
  }
}

app.get('/ips', async (req, res) => {
  try {
    // Fetch proxy data from all four sources
    const [proxyScrapeResponse, geoNodeResponse, githubResponse, proxyEliteProxies] = await Promise.all([
      fetch('https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&country=in&proxy_format=ipport&format=json'),
      fetch('https://proxylist.geonode.com/api/proxy-list?country=IN&filterUpTime=60&limit=500&page=1&sort_by=lastChecked&sort_type=desc'),
      fetch('https://github.com/Shashwat-CODING/yt/raw/refs/heads/main/proxy.json'),
      scrapeProxyElite() // New source: ProxyElite scraping
    ]);
    
    // Check if API responses are successful
    if (!proxyScrapeResponse.ok) {
      throw new Error(`ProxyScrape API error! Status: ${proxyScrapeResponse.status}`);
    }
    
    if (!geoNodeResponse.ok) {
      throw new Error(`GeoNode API error! Status: ${geoNodeResponse.status}`);
    }
    
    if (!githubResponse.ok) {
      throw new Error(`GitHub API error! Status: ${githubResponse.status}`);
    }
    
    // Parse all responses
    const proxyScrapeData = await proxyScrapeResponse.json();
    const geoNodeData = await geoNodeResponse.json();
    const githubData = await githubResponse.json();
    
    // Extract HTTP proxies from ProxyScrape
    const httpProxies = proxyScrapeData.proxies
      .filter(proxy => proxy.protocol === 'http')
      .map(proxy => `${proxy.ip}:${proxy.port}`);
    
    // Extract proxies from GeoNode
    const geoNodeProxies = geoNodeData.data.map(proxy => `${proxy.ip}:${proxy.port}`);
    
    // Extract proxies from GitHub
    const githubProxies = githubData.proxies || [];
    
    // Combine all lists and remove duplicates
    const allProxies = [...new Set([...httpProxies, ...geoNodeProxies, ...githubProxies, ...proxyEliteProxies])];
    
    // Format the response as requested
    const formattedResponse = {
      proxies: allProxies
    };
    
    res.json(formattedResponse);
  } catch (error) {
    console.error('Error fetching proxies:', error);
    res.status(500).json({ error: 'Failed to fetch proxy data', message: error.message });
  }
});

// For health check
app.get('/', (req, res) => {
  res.send('Proxy API is running');
});

// Add endpoint to get stats about the number of proxies
app.get('/stats', async (req, res) => {
  try {
    const response = await fetch('http://localhost:' + (process.env.PORT || 3000) + '/ips');
    const data = await response.json();
    
    res.json({
      total: data.proxies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

// Add endpoint to get proxies from ProxyElite only
app.get('/proxyElite', async (req, res) => {
  try {
    const proxies = await scrapeProxyElite();
    res.json({
      proxies: proxies,
      count: proxies.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ProxyElite data', message: error.message });
  }
});

export default app;