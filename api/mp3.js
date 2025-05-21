import express from 'express';
import fetch from 'node-fetch';

const app = express();
const INSTANCES_JSON_URL = "https://raw.githubusercontent.com/n-ce/Uma/main/dynamic_instances.json";

// Function to fetch the latest Invidious instance from the JSON source
async function getLatestInvidiousInstance() {
  try {
    const response = await fetch(INSTANCES_JSON_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch instances: ${response.status}`);
    }
    
    const instancesData = await response.json();
    
    // Check if invidious array exists and has at least one instance
    if (instancesData.invidious && instancesData.invidious.length > 0) {
      return instancesData.invidious[0]; // Use the first invidious instance
    } else {
      throw new Error("No Invidious instances found in JSON");
    }
  } catch (error) {
    console.error("Error fetching instances JSON:", error);
    throw error;
  }
}

class InvidiousAPI {
  constructor(instanceUrl = null) {
    this.instanceUrl = instanceUrl;
  }
  
  // Ensure we have the latest instance before making any API call
  async getInstanceUrl() {
    if (!this.instanceUrl) {
      this.instanceUrl = await getLatestInvidiousInstance();
    }
    return this.instanceUrl;
  }
  
  // Reset the instance (useful for retrying with a fresh instance)
  async refreshInstance() {
    this.instanceUrl = await getLatestInvidiousInstance();
    return this.instanceUrl;
  }

  // Replace the host URL in videoplayback URLs with the Invidious instance
  replaceUrlHost(originalUrl) {
    try {
      // Check if the URL contains '/videoplayback'
      if (originalUrl.includes('/videoplayback')) {
        // Extract the path starting from '/videoplayback'
        const videoPlaybackPath = originalUrl.substring(originalUrl.indexOf('/videoplayback'));
        // Combine the instance URL with the videoplayback path
        return `${this.instanceUrl}${videoPlaybackPath}`;
      }
      // If not a videoplayback URL, return original
      return originalUrl;
    } catch (error) {
      console.error("Error replacing URL hst:", error);
      return originalUrl;
    }
  }

  async getVideoData(videoId) {
    try {
      const instance = await this.getInstanceUrl();
      console.log(`Fetching video data for ${videoId} from ${instance}`);
      
      // Use the Invidious API endpoint
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video data: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error fetching video data:", error);
      
      // If there was an error, try refreshing the instance once
      try {
        const newInstance = await this.refreshInstance();
        console.log(`Retrying with new instance: ${newInstance}`);
        
        const retryResponse = await fetch(`${newInstance}/api/v1/videos/${videoId}`);
        
        if (!retryResponse.ok) {
          throw new Error(`Retry failed: ${retryResponse.status}`);
        }
        
        return await retryResponse.json();
      } catch (retryError) {
        console.error("Retry failed:", retryError);
        throw retryError;
      }
    }
  }

  async getHighestQualityOpusUrl(videoId) {
    const videoData = await this.getVideoData(videoId);
    if (!videoData || (!videoData.adaptiveFormats && !videoData.formatStreams)) {
      throw new Error("Failed to retrieve audio formats.");
    }
    
    // Get the video title from the Invidious response
    const title = videoData.title || `video-${videoId}`;
    
    // First try to find audio in adaptiveFormats (usually higher quality)
    if (videoData.adaptiveFormats && videoData.adaptiveFormats.length > 0) {
      // Look for audio formats - in Invidious they're identified by type containing 'audio'
      const audioFormats = videoData.adaptiveFormats.filter(format => 
        format.type && format.type.includes('audio')
      );
      
      if (audioFormats.length > 0) {
        // Sort by bitrate in descending order (convert string to number if needed)
        audioFormats.sort((a, b) => {
          const bitrateA = typeof a.bitrate === 'string' ? parseInt(a.bitrate) : a.bitrate;
          const bitrateB = typeof b.bitrate === 'string' ? parseInt(b.bitrate) : b.bitrate;
          return bitrateB - bitrateA;
        });
        
        // Replace the host URL with the Invidious instance
        let bestAudioUrl = this.replaceUrlHost(audioFormats[0].url);
        
        return { url: bestAudioUrl, title };
      }
    }
    
    // Fallback to formatStreams if no audio found in adaptiveFormats
    if (videoData.formatStreams && videoData.formatStreams.length > 0) {
      // Sort formatStreams by quality
      const sortedFormats = [...videoData.formatStreams].sort((a, b) => {
        const bitrateA = typeof a.bitrate === 'string' ? parseInt(a.bitrate) : (a.bitrate || 0);
        const bitrateB = typeof b.bitrate === 'string' ? parseInt(b.bitrate) : (b.bitrate || 0);
        return bitrateB - bitrateA;
      });
      
      if (sortedFormats.length > 0) {
        // Replace the host URL with the Invidious instance
        let audioUrl = this.replaceUrlHost(sortedFormats[0].url);
        
        return { url: audioUrl, title };
      }
    }
    
    // Last resort: try to use the dash or hls URL if available
    if (videoData.dashUrl) {
      return { url: this.replaceUrlHost(videoData.dashUrl), title, format: 'dash' };
    }
    
    if (videoData.hlsUrl) {
      return { url: this.replaceUrlHost(videoData.hlsUrl), title, format: 'hls' };
    }
    
    throw new Error("No suitable audio format found.");
  }
}

// Initialize API without an instance - it will be fetched on first use
const api = new InvidiousAPI();

// MP3 (Audio) download endpoint with CORS handling
app.get('/mp3/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      status: 'error',
      error: { code: 'missing_video_id', message: "No video ID provided" }
    });
  }

  try {
    const { url, title, format } = await api.getHighestQualityOpusUrl(videoId);
    
    // Set proper CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Send the response
    res.json({
      status: 'tunnel',
      url,
      filename: title,
      format: format || 'audio'
    });
  } catch (error) {
    console.error("MP3 endpoint error:", error);
    res.status(500).json({
      status: 'error',
      error: { code: 'fetch_failed', message: error.message }
    });
  }
});

// Handle OPTIONS requests for CORS preflight
app.options('/mp3/:videoId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Add a health check endpoint
app.get('/health', async (req, res) => {
  try {
    const instance = await api.getInstanceUrl();
    res.json({
      status: 'ok',
      currentInstance: instance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default app;