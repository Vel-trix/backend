import express from 'express';
import fetch from 'node-fetch';

const app = express();
const RAAG_API_BASE_URL = "https://raag-emergency.vercel.app/api/streams";

class RaagAPI {
  async getVideoData(videoId) {
    try {
      console.log(`Fetching video data for ${videoId} from Raag API`);
      
      // Use the Raag API endpoint
      const response = await fetch(`${RAAG_API_BASE_URL}/${videoId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video data: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching video data:", error);
      throw error;
    }
  }
  
  async get360pVideoUrl(videoId) {
    const videoData = await this.getVideoData(videoId);
    if (!videoData || !videoData.formats || videoData.formats.length === 0) {
      throw new Error("Failed to retrieve video formats.");
    }
    
    // Get the video title from the response
    const title = videoData.title || `video-${videoId}`;
    
    // Look for 360p format in formats
    const format360p = videoData.formats.find(format => 
      format.qualityLabel === '360p' || format.quality === 'medium'
    );
    
    // If 360p is found, return it
    if (format360p) {
      return { url: format360p.url, title, quality: '360p' };
    }
    
    // If no 360p found, find the closest resolution
    const sortedFormats = [...videoData.formats].sort((a, b) => {
      // Extract resolution height numbers (e.g., '360p' -> 360)
      const getHeight = (qualityLabel) => {
        const q = qualityLabel || '';
        const match = q.match(/(\d+)p/);
        return match ? parseInt(match[1]) : 0;
      };
      
      const heightA = getHeight(a.qualityLabel);
      const heightB = getHeight(b.qualityLabel);
      
      // Sort by how close the resolution is to 360p
      return Math.abs(heightA - 360) - Math.abs(heightB - 360);
    });
    
    if (sortedFormats.length > 0) {
      const quality = sortedFormats[0].qualityLabel || 'unknown';
      
      return { 
        url: sortedFormats[0].url, 
        title, 
        quality, 
        note: quality !== '360p' ? `360p not available, using closest: ${quality}` : undefined
      };
    }
    
    throw new Error("No suitable video format found.");
  }

  async get360pVideoWithoutAudio(videoId) {
    const videoData = await this.getVideoData(videoId);
    if (!videoData || !videoData.adaptiveFormats || videoData.adaptiveFormats.length === 0) {
      throw new Error("Failed to retrieve adaptive video formats.");
    }
    
    // Get the video title from the response
    const title = videoData.title || `video-${videoId}`;
    
    // Filter for video-only streams (no audio)
    const videoOnlyStreams = videoData.adaptiveFormats.filter(format => 
      format.mimeType && format.mimeType.startsWith('video/') && !format.mimeType.includes('audio')
    );
    
    if (videoOnlyStreams.length === 0) {
      throw new Error("No video-only streams found.");
    }
    
    // Look for 360p format in video-only streams
    const format360p = videoOnlyStreams.find(format => 
      format.qualityLabel === '360p'
    );
    
    // If 360p is found, return it
    if (format360p) {
      return { url: format360p.url, title, quality: '360p', hasAudio: false };
    }
    
    // If no 360p found, find the closest resolution
    const sortedFormats = [...videoOnlyStreams].sort((a, b) => {
      // Extract resolution height numbers (e.g., '360p' -> 360)
      const getHeight = (qualityLabel) => {
        const q = qualityLabel || '';
        const match = q.match(/(\d+)p/);
        return match ? parseInt(match[1]) : 0;
      };
      
      const heightA = getHeight(a.qualityLabel);
      const heightB = getHeight(b.qualityLabel);
      
      // Sort by how close the resolution is to 360p
      return Math.abs(heightA - 360) - Math.abs(heightB - 360);
    });
    
    if (sortedFormats.length > 0) {
      const quality = sortedFormats[0].qualityLabel || 'unknown';
      
      return { 
        url: sortedFormats[0].url, 
        title, 
        quality, 
        hasAudio: false,
        note: quality !== '360p' ? `360p not available, using closest: ${quality}` : undefined
      };
    }
    
    throw new Error("No suitable video-only format found.");
  }
}

// Initialize API
const api = new RaagAPI();

// Video endpoint for 360p video without audio
app.get('/video/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      status: 'error',
      error: { code: 'missing_video_id', message: "No video ID provided" }
    });
  }

  try {
    const { url, title, quality, note, hasAudio } = await api.get360pVideoWithoutAudio(videoId);
    
    // Set proper CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Send the response with original URL
    res.json({
      status: 'success',
      url,
      filename: title,
      quality,
      hasAudio,
      note,
      format: 'video'
    });
  } catch (error) {
    console.error("Video endpoint error:", error);
    res.status(500).json({
      status: 'error',
      error: { code: 'fetch_failed', message: error.message }
    });
  }
});

// Keep the original 360p endpoint
app.get('/videoaud/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      status: 'error',
      error: { code: 'missing_video_id', message: "No video ID provided" }
    });
  }

  try {
    const { url, title, quality, note } = await api.get360pVideoUrl(videoId);
    
    // Set proper CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Send the response
    res.json({
      status: 'success',
      url,
      filename: title,
      quality,
      note,
      format: 'video'
    });
  } catch (error) {
    console.error("Video endpoint error:", error);
    res.status(500).json({
      status: 'error',
      error: { code: 'fetch_failed', message: error.message }
    });
  }
});

// Handle OPTIONS requests for CORS preflight for both endpoints
app.options('/video/:videoId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.options('/videoaud/:videoId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Add a health check endpoint
app.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      service: 'Raag API wrapper'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default app;