import express from "express";
import { Client } from "@gradio/client";

const app = express();

app.post("/infer", async (req, res) => {
  const { prompt } = req.body;
  
  try {
    const client = await Client.connect("Heartsync/censored");
    
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

    await client.close();
    
    res.json(result);
  } catch (err) {
    console.error("Error during prediction:", err);
    res.status(500).send("Error during prediction");
  }
});

export default app;
