import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

app.use(cors());
app.use(express.json());

const INVIDIOUS_INSTANCE = "https://invidious.nikkosphere.com";
const COBALT_API = "https://cobalt-api.kwiatekmiki.com";

class InvidiousAPI {
    constructor(instance = INVIDIOUS_INSTANCE) {
        this.instance = instance;
    }

    replaceUrlHost(originalUrl) {
        try {
            const url = new URL(originalUrl);
            return `${this.instance}${url.pathname}${url.search}`;
        } catch (error) {
            console.error("Error replacing URL host:", error);
            return originalUrl;
        }
    }

    async transformResponse(invidiousData) {
        if (!invidiousData) {
            throw new Error("No data received from Invidious");
        }

        const adaptiveFormats = invidiousData.adaptiveFormats?.map(format => {
            const isAudio = format.type?.includes('audio');
            const base = {
                itag: format.itag || Math.floor(Math.random() * 1000),
                mimeType: format.type || `${isAudio ? 'audio' : 'video'}/${format.container}; codecs="${format.encoding}"`,
                bitrate: format.bitrate,
                width: format.width,
                height: format.height,
                lastModified: Date.now().toString(),
                quality: format.quality,
                fps: format.fps,
                qualityLabel: format.qualityLabel,
                projectionType: "RECTANGULAR",
                averageBitrate: format.bitrate,
                approxDurationMs: (invidiousData.lengthSeconds * 1000).toString(),
                url: this.replaceUrlHost(format.url),
                signatureCipher: "",
                colorInfo: {
                    primaries: isAudio ? "" : "COLOR_PRIMARIES_BT709",
                    transferCharacteristics: isAudio ? "" : "COLOR_TRANSFER_CHARACTERISTICS_BT709",
                    matrixCoefficients: isAudio ? "" : "COLOR_MATRIX_COEFFICIENTS_BT709"
                }
            };

            if (isAudio) {
                return {
                    ...base,
                    audioQuality: format.quality === "AUDIO_QUALITY_MEDIUM" ? "AUDIO_QUALITY_MEDIUM" : "AUDIO_QUALITY_LOW",
                    audioSampleRate: format.audioSampleRate || "44100",
                    audioChannels: 2,
                    loudnessDb: 3.1400003
                };
            }

            return base;
        }) || [];

        const formats = invidiousData.formatStreams?.map(format => ({
            itag: format.itag || Math.floor(Math.random() * 1000),
            mimeType: `video/${format.container}; codecs="${format.encoding}"`,
            bitrate: format.bitrate,
            width: format.width,
            height: format.height,
            lastModified: Date.now().toString(),
            contentLength: format.size?.toString() || "",
            quality: format.quality,
            fps: format.fps,
            qualityLabel: format.qualityLabel,
            projectionType: "RECTANGULAR",
            averageBitrate: format.bitrate,
            audioQuality: "AUDIO_QUALITY_LOW",
            approxDurationMs: (invidiousData.lengthSeconds * 1000).toString(),
            audioSampleRate: "44100",
            audioChannels: 2,
            signatureCipher: "",
            url: this.replaceUrlHost(format.url)
        })) || [];

        return {
            responseContext: {
                visitorData: "BASE64_VISITOR_DATA",
                serviceTrackingParams: [
                    {
                        service: "GFEEDBACK",
                        params: [
                            {
                                key: "logged_in",
                                value: "0"
                            }
                        ]
                    }
                ]
            },
            playabilityStatus: {
                status: invidiousData.error ? "UNPLAYABLE" : "OK",
                playableInEmbed: true,
                contextParams: "Q0FFU0FnZ0I="
            },
            streamingData: {
                expiresInSeconds: "21540",
                formats,
                adaptiveFormats,
            },
            videoDetails: {
                videoId: invidiousData.videoId,
                title: invidiousData.title,
                lengthSeconds: invidiousData.lengthSeconds?.toString(),
                channelId: invidiousData.authorId,
                isOwnerViewing: false,
                isCrawlable: true,
                thumbnail: {
                    thumbnails: invidiousData.videoThumbnails?.map(thumb => ({
                        url: thumb.url,
                        width: thumb.width,
                        height: thumb.height
                    })) || []
                },
                allowRatings: true,
                author: invidiousData.author,
                isPrivate: false,
                isUnpluggedCorpus: false,
                musicVideoType: "",
                isLiveContent: invidiousData.liveNow
            },
            microformat: {
                microformatDataRenderer: {
                    urlCanonical: "",
                    title: "",
                    description: "",
                    thumbnail: {
                        thumbnails: []
                    },
                    siteName: "",
                    appName: "",
                    androidPackage: "",
                    iosAppStoreId: "",
                    iosAppArguments: "",
                    ogType: "",
                    urlApplinksIos: "",
                    urlApplinksAndroid: "",
                    urlTwitterIos: "",
                    urlTwitterAndroid: "",
                    twitterCardType: "",
                    twitterSiteHandle: "",
                    schemaDotOrgType: "",
                    noindex: false,
                    unlisted: false,
                    paid: false,
                    familySafe: true
                }
            },
            trackingParams: "CAAQu2kiEwjN3pqf86yLAxWfwHMBHf56B9U="
        };
    }

    async getVideoData(videoId) {
        try {
            console.log(`Fetching video data for ${videoId} from ${this.instance}`);
            const response = await fetch(`${this.instance}/api/v1/videos/${videoId}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to fetch video data: ${response.status}`);
            }

            const data = await response.json();
            return await this.transformResponse(data);

        } catch (error) {
            console.error("Error fetching video data:", error);
            return {
                playabilityStatus: {
                    status: "UNPLAYABLE",
                    reason: error.message
                },
                error: true
            };
        }
    }
}

// Add new function to handle Cobalt API requests for MP3
async function getCobaltAudioDownload(videoId) {
    try {
        const response = await fetch(`${COBALT_API}/`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: `https://youtube.com/watch?v=${videoId}`,
                downloadMode: "audio",         // Audio-only mode
                audioFormat: "mp3",            // MP3 format         // Highest quality bitrate
                filenameStyle: "basic",        // Basic filename style
                disableMetadata: false         // Keep metadata
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.code || `Failed to fetch Cobalt data: ${response.status}`);
        }

        const data = await response.json();

        // Handle different response types
        switch (data.status) {
            case 'error':
                throw new Error(data.error.code || 'Unknown error occurred');
            case 'redirect':
            case 'tunnel':
                return {
                    status: data.status,
                    url: data.url,
                    filename: data.filename
                };
            default:
                throw new Error('Unexpected response status from Cobalt API');
        }
    } catch (error) {
        console.error("Error fetching Cobalt audio download:", error);
        throw error;
    }
}

const api = new InvidiousAPI();

// Original video player endpoint

// New MP3 download endpoint
app.get('/cobalt/:videoId', async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
        return res.status(400).json({
            status: 'error',
            error: {
                code: 'missing_video_id',
                message: "No video ID provided"
            }
        });
    }

    try {
        const data = await getCobaltAudioDownload(videoId);
        res.json(data);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: {
                code: 'processing_failed',
                message: error.message || "Failed to fetch audio download information"
            }
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Cobalt health check endpoint
app.get('/cobalt/health', async (req, res) => {
    try {
        const response = await fetch(`${COBALT_API}/`);
        const data = await response.json();
        res.json({
            status: 'ok',
            version: data.cobalt.version,
            services: data.cobalt.services,
            durationLimit: data.cobalt.durationLimit
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

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

// ... (rest of the existing code remains the same)

export default app;