import fetch from 'node-fetch';
import express from 'express';

const app = express();

const PIPED_INSTANCE = "https://pipedapi.kavin.rocks"; // You can change this to any Piped instance

// Add PipedAPI class
class PipedAPI {
    constructor(instance = PIPED_INSTANCE) {
        this.instance = instance;
    }

    async getAllChannelVideos(channelId, progressCallback = null) {
        try {
            let allVideos = [];
            let nextpage = null;
            let channelInfo = null;
            let pageCount = 0;

            do {
                // Fetch current page
                const url = nextpage 
                    ? `${this.instance}/nextpage/channel/${channelId}?nextpage=${encodeURIComponent(nextpage)}`
                    : `${this.instance}/channel/${channelId}`;

                const response = await fetch(url);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Failed to fetch channel data: ${response.status}`);
                }

                const data = await response.json();
                pageCount++;

                // Store channel info from first page
                if (!channelInfo) {
                    channelInfo = {
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        verified: data.verified,
                        subscribers: data.subscriberCount,
                        thumbnailUrl: data.avatarUrl,
                        bannerUrl: data.bannerUrl,
                    };
                }

                // Transform and store videos from current page
                const pageVideos = data.relatedStreams.map(video => ({
                    id: video.url.split('v=')[1] || video.url.split('/').pop(),
                    title: video.title,
                    thumbnail: video.thumbnail,
                    duration: video.duration,
                    views: video.views,
                    uploadDate: video.uploadedDate,
                    uploaded: video.uploaded,
                    uploaderName: video.uploaderName,
                    uploaderId: video.uploaderId,
                    shortDescription: video.shortDescription
                }));

                allVideos = allVideos.concat(pageVideos);

                // Update progress if callback provided
                if (progressCallback) {
                    progressCallback({
                        videosFound: allVideos.length,
                        pagesProcessed: pageCount
                    });
                }

                // Get next page token
                nextpage = data.nextpage;

                // Add a small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));

            } while (nextpage);

            return {
                channelInfo,
                videos: allVideos,
                stats: {
                    totalVideos: allVideos.length,
                    pagesProcessed: pageCount
                }
            };

        } catch (error) {
            console.error("Error fetching channel data:", error);
            throw error;
        }
    }
}

const pipedApi = new PipedAPI();

// Add the channel videos endpoint that returns all videos
app.get('/c/:channelId', async (req, res) => {
    const { channelId } = req.params;

    if (!channelId) {
        return res.status(400).json({
            status: 'error',
            error: {
                code: 'missing_channel_id',
                message: "No channel ID provided"
            }
        });
    }

    // Set up Server-Sent Events if client supports it
    const acceptsSSE = req.headers.accept?.includes('text/event-stream');
    if (acceptsSSE) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
    }

    try {
        // Progress callback for SSE
        const progressCallback = acceptsSSE ? (progress) => {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        } : null;

        // Fetch all videos
        const result = await pipedApi.getAllChannelVideos(channelId, progressCallback);

        // Sort videos by upload date (newest first)
        result.videos.sort((a, b) => b.uploaded - a.uploaded);

        // Prepare final response
        const response = {
            status: 'ok',
            channelInfo: result.channelInfo,
            stats: result.stats,
            videos: result.videos
        };

        // Send response based on client capability
        if (acceptsSSE) {
            res.write(`data: ${JSON.stringify({ ...response, type: 'complete' })}\n\n`);
            res.end();
        } else {
            res.json(response);
        }
    } catch (error) {
        const errorResponse = {
            status: 'error',
            error: {
                code: 'channel_fetch_failed',
                message: error.message || "Failed to fetch channel videos"
            }
        };

        if (acceptsSSE) {
            res.write(`data: ${JSON.stringify({ ...errorResponse, type: 'error' })}\n\n`);
            res.end();
        } else {
            res.status(500).json(errorResponse);
        }
    }
});

export default app;
