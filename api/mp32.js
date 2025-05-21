const express = require("express");
const tunnel = require("tunnel");
const app = express();

const PORT = 3100;

// Proxy credentials and address
const proxyUrl = "gw.dataimpulse.com";
const proxyPort = 823;
const proxyAuth = "c071936660f5aa2d7156:476cc9733201022f";

// Create tunneling agent
const agent = tunnel.httpOverHttp({
  proxy: {
    host: proxyUrl,
    port: proxyPort,
    proxyAuth: proxyAuth
  }
});

const startServer = async () => {
  // Import got dynamically
  const { default: got } = await import('got');

  app.get("/proxy", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing ?url parameter");

    // Validate URL
    try {
      new URL(targetUrl);
    } catch (e) {
      return res.status(400).send("Invalid URL provided");
    }

    try {
      const response = got.stream(targetUrl, {
        agent: agent,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "*/*",
          "Accept-Encoding": "gzip, deflate, br"
        },
        timeout: {
          request: 30000 // 30 seconds
        },
        retry: {
          limit: 2
        }
      });

      // Forward response headers
      response.on('response', (proxyRes) => {
        // Log successful connection
        console.log(`Proxying request to: ${targetUrl}`);
        console.log(`Status code: ${proxyRes.statusCode}`);
        
        // Copy all relevant headers
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          try {
            if (value) res.setHeader(key, value);
          } catch (err) {
            console.warn(`Failed to set header ${key}:`, err.message);
          }
        });
      });

      response.on("error", (err) => {
        console.error("Stream error for URL:", targetUrl);
        console.error("Error details:", err);
        
        if (!res.headersSent) {
          if (err.code === 'ECONNREFUSED') {
            res.status(502).send("Unable to connect to target server");
          } else if (err.code === 'ETIMEDOUT') {
            res.status(504).send("Request timed out");
          } else {
            res.status(500).send(`Proxy error: ${err.message}`);
          }
        }
      });

      response.pipe(res);
    } catch (err) {
      console.error("Request failed for URL:", targetUrl);
      console.error("Error:", err);
      res.status(500).send(`Proxy request failed: ${err.message}`);
    }
  });

  app.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);
