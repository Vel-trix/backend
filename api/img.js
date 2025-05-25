import express from "express";
import { Client } from "@gradio/client";

const app = express();

// Helper function to wait between retries
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to create client with retries
async function createClientWithRetry(maxRetries = 3, retryDelay = 2000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await Client.connect("Heartsync/censored", {
        timeout: 30000, // 30 second timeout
        retry: true,
        retryAttempts: 3
      });
      return client;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay/1000} seconds...`);
        await wait(retryDelay);
        // Increase delay for next attempt
        retryDelay *= 1.5;
      }
    }
  }
  
  throw new Error(`Failed to connect after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

app.post("/infer", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  let client;
  try {
    // Create client with retry logic
    client = await createClientWithRetry();
    
    const result = await client.predict("/infer", {
      prompt,
      negative_prompt: "text, talk bubble, low quality, watermark, signature",
      seed: 0,
      randomize_seed: true,
      width: 1024,
      height: 1024,
      guidance_scale: 7,
      num_inference_steps: 28,
    });

    res.json(result);
  } catch (err) {
    console.error("Error during prediction:", err);
    res.status(500).json({ 
      error: "Error during prediction",
      details: err.message
    });
  } finally {
    // Ensure client is closed even if there's an error
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error("Error closing client:", closeError);
      }
    }
  }
});

export default app;
