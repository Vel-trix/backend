import axios from 'axios';
import express from 'express';
import cors from 'cors';

const app = express();


app.use(cors());

const API_KEYS = [
     'AIzaSyDityTDJTUtE5G6REzEQsp89IadbOZ9LpU',
    'AIzaSyCAEHmYGSPEVzgKVTsHm4bQVf0HfRlXn2A',
    'AIzaSyB7R3K2YSO3Rej5TKEHhGPCq0S68SQ9dLg',
    'AIzaSyBzazlqoS0kqt_y63H4jZnFo23QYbJVLJw'
];

let currentKeyIndex = 0;
const MIN_DURATION_SECONDS = 120; // 2 minutes minimum duration
const durationCache = new Map();

function getNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return API_KEYS[currentKeyIndex];
}

const CHANNEL_IDS = [
    'UCHa1_v_jRPdJFdU9tmOwxDA',  //Gaurav katare Extra
    'UC0XWC2_UZMkXPGn4bj0R2Uw', //scary pumpkin
    'UCpGhKw1m80zRsS7xUvUruaQ', //Once Upon A Time - Horror Hindi
    'UC2OE2tbj4O3wo14M-tspGzw',  //HORROR PODCAST SHOW
    'UCYvVfuQo-9NhINSxJ-W_--Q', // Skull Tales
    'UCyBzV_g6Vfv5GM3aMQb3Y_A', // Alpha Akki
    'UCrB8j1YCbuYhIcImwNkJgCg', // Alpha Akki Dark
    'UCPGNioeYrJq4nyAt-DVIHZg', // SR PAY STORIES
    'UCEEi1lDCkKi1ukmTAgc9-zA', // ShivamIsOn
    'UCVIq229U5A54UVzHQJqZCPQ', // Akshay Vashisht
    'UCcKMjICfQPjiVMpqS-yF7hA', // Thrill Tales
    'UCWcQCJHYOK2ZZRA2Sym0mOw', // Amaan Parkar
    'UCn372MiubHTkPFwxKVv45LQ', // Fintale
    'UCUF0EGa7_yM4TXQl4LYt-YA', // Alpha Crime
    'UCRidj8Tvrnf5jeIwzFDj0FQ', // BADMASH icON
    'UCz67TNWBqU38S8VRvjDO2wg'  // Khooni Monday
];


const axiosInstance = axios.create({
    timeout: 100000
});

function parseDuration(duration) {
    const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!matches) return 0;
    
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);
    
    return hours * 3600 + minutes * 60 + seconds;
}

async function getVideoDetails(videoIds, retryCount = 0) {
    if (!videoIds.length) return [];
    
    try {
        const response = await axiosInstance.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                key: API_KEYS[currentKeyIndex],
                part: 'contentDetails,statistics',
                id: videoIds.join(','),
                maxResults: 50
            }
        });

        if (!response.data || !response.data.items) {
            throw new Error('Invalid response format for video details');
        }

        return response.data.items.map(item => ({
            id: item.id,
            duration: parseDuration(item.contentDetails.duration),
            viewCount: item.statistics.viewCount,
            // Check for age restriction by looking at content rating
            isAgeRestricted: item.contentDetails.contentRating && 
                             (item.contentDetails.contentRating.ytRating === 'ytAgeRestricted' ||
                             !!item.contentDetails.contentRating.mpaaRating ||
                             !!item.contentDetails.contentRating.tvpgRating)
        }));

    } catch (error) {
        if (error.response && error.response.status === 403 && retryCount < API_KEYS.length) {
            const nextKey = getNextApiKey();
            console.log(`Switching to next API key for video details: ${nextKey}`);
            return getVideoDetails(videoIds, retryCount + 1);
        }
        console.error('Error fetching video details:', error.message);
        return [];
    }
}

async function searchChannel(channelId, query, retryCount = 0) {
    try {
        const response = await axiosInstance.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                key: API_KEYS[currentKeyIndex],
                part: 'snippet',
                channelId: channelId,
                q: query,
                type: 'video',
                maxResults: 10,
                fields: 'items(id/videoId,snippet/title,snippet/description,snippet/publishedAt,snippet/channelTitle,snippet/channelId)'
            }
        });

        if (!response.data || !response.data.items) {
            throw new Error(`Invalid response format for channel ${channelId}`);
        }

        const videoIds = response.data.items.map(item => item.id.videoId);
        const videoDetails = await getVideoDetails(videoIds);

        // Filter videos by duration, non-age-restricted, and combine with search results
        const validVideos = response.data.items.filter(item => {
            const details = videoDetails.find(v => v.id === item.id.videoId);
            // Filter out videos that are too short or age-restricted
            return details && 
                  details.duration >= MIN_DURATION_SECONDS && 
                  !details.isAgeRestricted;
        }).map(item => {
            const details = videoDetails.find(v => v.id === item.id.videoId);
            return {
                ...item,
                duration: details.duration,
                viewCount: details.viewCount
            };
        });

        return validVideos;

    } catch (error) {
        if (error.response && error.response.status === 403 && retryCount < API_KEYS.length) {
            const nextKey = getNextApiKey();
            console.log(`Switching to next API key: ${nextKey}`);
            return searchChannel(channelId, query, retryCount + 1);
        }
        console.error(`Error searching channel ${channelId}:`, error.message);
        return [];
    }
}
// Add this deduplication function near the top of your file
function deduplicateVideos(videos) {
    // Use a Map to track unique videos by ID
    const uniqueVideosMap = new Map();
    
    videos.forEach(video => {
        // Extract videoId from the URL or use the id directly
        const videoId = video.id?.videoId || 
                       (video.url && video.url.includes('v=') ? video.url.split('v=')[1] : null) || 
                       video.id;
        
        // Only add if we haven't seen this video before
        if (videoId && !uniqueVideosMap.has(videoId)) {
            uniqueVideosMap.set(videoId, video);
        }
    });
    
    // Convert Map back to array
    return Array.from(uniqueVideosMap.values());
}

// Updated /search endpoint with deduplication
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({
                error: 'Query parameter is required',
                code: 'MISSING_QUERY'
            });
        }

        const results = await Promise.allSettled(
            CHANNEL_IDS.map(channelId => searchChannel(channelId, query))
        );

        const validResults = results
            .filter(result => result.status === 'fulfilled')
            .flatMap(result => result.value);

        if (validResults.length === 0) {
            return res.status(404).json({
                error: 'No results found',
                code: 'NO_RESULTS'
            });
        }

        const transformedResults = validResults
            .map(item => ({
                type: 'stream',
                url: `/watch?v=${item.id.videoId}`,
                title: item.snippet.title || '',
                thumbnail: `https://pol1.piproxy.ggtyler.dev/vi/${item.id.videoId}?host=i.ytimg.com`,
                uploaderName: item.snippet.channelTitle || '',
                uploaderUrl: `/channel/${item.snippet.channelId}`,
                uploadedDate: item.snippet.publishedAt || '',
                duration: item.duration,
                views: parseInt(item.viewCount) || 0,
                uploaderVerified: false,
                shortDescription: item.snippet.description || '',
                uploaded: item.snippet.publishedAt ? Date.parse(item.snippet.publishedAt) / 1000 : null,
                uploaderAvatar: null,
                isShort: false
            }))
            .filter(result => result.url && result.title && result.duration >= MIN_DURATION_SECONDS);

        // Apply deduplication before sorting
        const dedupedResults = deduplicateVideos(transformedResults);
        
        // Then sort
        dedupedResults.sort((a, b) => (b.uploaded || 0) - (a.uploaded || 0));

        res.json({
            items: dedupedResults,
            message: 'Success',
            code: 'OK'
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});

// Updated /featured endpoint with deduplication
// Completely rewritten /featured endpoint with parallel API requests
app.get('/featured', async (req, res) => {
    try {
        console.log('Fetching featured videos from all channels in parallel');
        
        // Piped API instances to try simultaneously
        const PIPED_APIS = [
            "https://pipedapi.leptons.xyz",
            "https://api.piped.yt",
            "https://pipedapi.reallyaweso.me",
            "https://pipedapi.adminforge.de",
            "https://nyc1.piapi.ggtyler.dev",
            "https://pol1.piapi.ggtyler.dev",
            "https://cal1.piapi.ggtyler.dev",
            "https://pipedapi.nosebs.ru",
            "https://pipedapi.orangenet.cc",
            "https://api.piped.private.coffee",
            "https://pipedapi.ducks.party",
            "https://piapi.ggtyler.dev"
        ];
        
        // Set a strict timeout for API requests
        const API_TIMEOUT = 3000; // 3 seconds timeout
        
        // Create a specific axios instance for featured endpoint
        const featuredAxios = axios.create({
            timeout: API_TIMEOUT
        });
        
        // Improved helper function that requests from all APIs in parallel and returns first success
        async function fetchChannelFromAnyApi(channelId) {
            // Create a promise for each API request
            const apiPromises = PIPED_APIS.map(apiBase => {
                return featuredAxios.get(`${apiBase}/channel/${channelId}`)
                    .then(response => {
                        if (response.data && response.data.relatedStreams) {
                            return response.data;
                        }
                        throw new Error('Invalid response structure');
                    })
                    .catch(err => {
                        // Silently fail individual requests
                        return null;
                    });
            });
            
            // Use Promise.race to get the first successful response
            const results = await Promise.allSettled(apiPromises);
            
            // Find the first fulfilled promise with valid data
            const firstSuccess = results
                .filter(result => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value)[0];
                
            return firstSuccess || { relatedStreams: [] };
        }
        
        // Process all channels in parallel for maximum speed
        const channelPromises = CHANNEL_IDS.map(async (channelId) => {
            try {
                const channelData = await fetchChannelFromAnyApi(channelId);
                
                // Filter videos that meet minimum duration requirement
                return channelData.relatedStreams.filter(video => 
                    video && 
                    typeof video.views === 'number' && 
                    video.duration && 
                    video.duration >= MIN_DURATION_SECONDS
                );
            } catch (error) {
                console.error(`Error processing channel ${channelId}:`, error.message);
                return [];
            }
        });
        
        // Wait for all channel data to be fetched
        const channelResults = await Promise.all(channelPromises);
        
        // Combine all videos
        let allVideos = channelResults.flat();
        
        // Remove duplicate videos
        const dedupedVideos = deduplicateVideos(allVideos);
        
        // Sort by view count (highest first)
        const sortedVideos = dedupedVideos.sort((a, b) => b.views - a.views);
        
        // Limit to top 100 videos
        const top100Videos = sortedVideos.slice(0, 100);
        
        if (top100Videos.length === 0) {
            return res.status(404).json({
                error: 'No featured videos found',
                code: 'NO_VIDEOS'
            });
        }
        
        // Return results
        res.json({
            items: top100Videos,
            totalItems: top100Videos.length,
            message: 'Success',
            code: 'OK'
        });
        
    } catch (error) {
        console.error('Featured videos error:', error);
        res.status(500).json({
            error: 'Failed to fetch featured videos',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});
// The rest of your code remains unchanged
app.get('/streams/:videoId', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const sources = [
            'https://raw.githubusercontent.com/Shashwat-CODER-Music/akkidark/refs/heads/main/d.json'
        ];

        let videoData = null;

        for (const source of sources) {
            try {
                const response = await axios.get(source);
                if (response.data[videoId]) {
                    videoData = response.data[videoId];
                    break;
                }
            } catch (sourceError) {
                console.error(`Error fetching from source ${source}:`, sourceError);
                continue;
            }
        }

        if (!videoData) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Get video duration if not already available
        const videoDetails = await getVideoDetails([videoId]);
        const duration = videoDetails.length > 0 ? videoDetails[0].duration : 0;
        
        // Check if video is age restricted
        if (videoDetails.length > 0 && videoDetails[0].isAgeRestricted) {
            return res.status(403).json({ 
                error: 'Video is age restricted',
                code: 'AGE_RESTRICTED_VIDEO'
            });
        }

        res.json({
            title: videoData.title,
            uploader: 'Podcast heaven',
            uploaderUrl: 'null',
            duration: duration,
            audioStreams: [
                {
                    url: videoData.filePath,
                    quality: '320 kbps',
                    mimeType: 'audio/webm; codecs="opus"',
                    codec: 'opus',
                    bitrate: 145140,
                    contentLength: videoData.size,
                    audioQuality: 'AUDIO_QUALITY_HIGH'
                }
            ]
        });
    } catch (error) {
        console.error('Error fetching stream details:', error);
        res.status(500).json({ error: 'Failed to fetch stream data' });
    }
});

app.get('/channel/:id', async (req, res) => {
    try {
        const channelId = req.params.id;
        const response = await axios.get(`https://pol1.piapi.ggtyler.dev/channel/${channelId}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /channel endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message
        });
    }
});

app.get('/nextpage/channel/:channelId', async (req, res) => {
    try {
        const channelId = req.params.channelId;
        const nextpage = req.query.nextpage;

        if (!nextpage) {
            return res.status(400).json({
                error: 'Nextpage parameter is required',
                code: 'MISSING_NEXTPAGE'
            });
        }

        // Prepare nextpage token for next request
        const getNextPageToken = (response, currentPageData) => {
            const continuationItems = response.data.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];
            const continuationItem = continuationItems.find(item => item.continuationItemRenderer);
            const continuation = continuationItem?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
            
            if (!continuation) return null;

            // Parse the original page data
            const pageData = JSON.parse(decodeURIComponent(currentPageData));
            const originalBody = JSON.parse(Buffer.from(pageData.body, 'base64').toString());
            
            // Create new page token with updated continuation
            return {
                url: "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false",
                id: null,
                ids: pageData.ids || [],
                cookies: null,
                body: Buffer.from(JSON.stringify({
                    ...originalBody,
                    continuation
                })).toString('base64')
            };
        };

        const fetchVideosPage = async (pageToken) => {
            const pageData = JSON.parse(decodeURIComponent(pageToken));
            const body = JSON.parse(Buffer.from(pageData.body, 'base64').toString());

            const response = await axios.post('https://www.youtube.com/youtubei/v1/browse', body, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-YouTube-Client-Name': '1',
                    'X-YouTube-Client-Version': '2.20240213.01.00',
                    'X-Origin': 'https://www.youtube.com'
                },
                params: {
                    key: API_KEYS[currentKeyIndex],
                    prettyPrint: false
                }
            });

            if (!response.data || !response.data.onResponseReceivedActions) {
                throw new Error('Invalid response format from YouTube API');
            }

            const itemsSection = response.data.onResponseReceivedActions[0]?.appendContinuationItemsAction?.continuationItems || [];
            
            // Extract videos from current page
            const videoItems = itemsSection
                .filter(item => item.richItemRenderer?.content?.videoRenderer)
                .map(item => {
                    const video = item.richItemRenderer.content.videoRenderer;
                    return {
                        videoId: video.videoId,
                        video: video
                    };
                });
            
            // Get video details to check for age restriction
            const videoIds = videoItems.map(item => item.videoId);
            const videoDetails = await getVideoDetails(videoIds);
            
            // Filter out age-restricted videos
            const videos = videoItems
                .filter(item => {
                    const details = videoDetails.find(v => v.id === item.videoId);
                    return details && !details.isAgeRestricted;
                })
                .map(item => {
                    const video = item.video;
                    const durationText = video.lengthText?.simpleText || '0:00';
                    const durationParts = durationText.split(':').map(Number);
                    const duration = durationParts.length === 3 
                        ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
                        : durationParts[0] * 60 + (durationParts[1] || 0);

                    return {
                        type: 'stream',
                        url: `/watch?v=${video.videoId}`,
                        title: video.title?.runs?.[0]?.text || '',
                        thumbnail: `https://pol1.piproxy.ggtyler.dev/vi/${video.videoId}?host=i.ytimg.com`,
                        uploaderName: video.ownerText?.runs?.[0]?.text || '',
                        uploaderUrl: `/channel/${channelId}`,
                        uploaderAvatar: null,
                        uploadedDate: video.publishedTimeText?.simpleText || '',
                        shortDescription: video.descriptionSnippet?.runs?.[0]?.text || '',
                        duration: duration,
                        views: parseInt(video.viewCountText?.simpleText?.replace(/[^0-9]/g, '')) || 0,
                        uploaded: Math.floor(Date.now() / 1000),
                        uploaderVerified: Boolean(video.ownerBadges?.find(badge => 
                            badge.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_VERIFIED"
                        )),
                        isShort: false
                    };
                });

            // Get next page token
            const nextPageToken = getNextPageToken(response, pageToken);

            return {
                nextpage: nextPageToken ? JSON.stringify(nextPageToken) : null,
                relatedStreams: videos,
                message: 'Success',
                code: 'OK'
            };
        };

        // Fetch and return the results
        const results = await fetchVideosPage(nextpage);
        res.json(results);

    } catch (error) {
        console.error('Error fetching videos:', error);
        if (error.response?.status === 403) {
            // Try with next API key if quota exceeded
            currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        }
        res.status(500).json({
            error: 'Failed to fetch videos',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        currentApiKey: `Key ${currentKeyIndex + 1} of ${API_KEYS.length}`
    });
});

// Updated getAllChannelVideos function with key rotation and better error handling
async function getAllChannelVideos(channelId, retryCount = 0) {
    try {
        let allVideos = [];
        let nextPageToken = null;
        let totalApiVideos = 0;

        do {
            const response = await axiosInstance.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    key: API_KEYS[currentKeyIndex],
                    part: 'id',
                    channelId: channelId,
                    maxResults: 50,
                    order: 'date',
                    type: 'video',
                    pageToken: nextPageToken
                }
            });

            if (!response.data || !response.data.items) {
                throw new Error(`Invalid response format for channel ${channelId}`);
            }

            // Extract video IDs
            const videos = response.data.items.map(item => item.id.videoId);
            
            // Get video details to check for age restriction
            const videoDetails = await getVideoDetails(videos);
            
            // Filter out age-restricted videos
            const nonRestrictedVideos = videos.filter(videoId => {
                const details = videoDetails.find(v => v.id === videoId);
                return details && !details.isAgeRestricted;
            });
            
            allVideos = allVideos.concat(nonRestrictedVideos);
            
            // Update total count from API
            totalApiVideos = response.data.pageInfo.totalResults;
            
            // Get next page token
            nextPageToken = response.data.nextPageToken;

            // Add delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));

            // Limit to 500 videos maximum to prevent excessive API usage
            if (allVideos.length >= 500) break;

        } while (nextPageToken);

        return {
            status: 'ok',
            videos: allVideos,
            stats: {
                totalVideos: totalApiVideos,
                fetchedVideos: allVideos.length
            }
        };
    } catch (error) {
        // Handle 403 error by switching API keys and retrying
        if (error.response && error.response.status === 403 && retryCount < API_KEYS.length - 1) {
            const nextKey = getNextApiKey();
            console.log(`Switching to next API key for getAllChannelVideos: ${nextKey}`);
            return getAllChannelVideos(channelId, retryCount + 1);
        }
        
        console.error(`Error fetching all videos for channel ${channelId}:`, error.message);
        throw error;
    }
}

// Updated list endpoint with better error handling
// Updated list endpoint using Piped API
app.get('/list/:channelId', async (req, res) => {
    try {
        const channelId = req.params.channelId;
        
        // Validate channel ID format (basic validation)
        if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) {
            return res.status(400).json({
                error: 'Invalid channel ID format',
                code: 'INVALID_CHANNEL_ID'
            });
        }
        
        // Piped API instances to try (reusing from other endpoints)
        const PIPED_APIS = [
            "https://pipedapi.leptons.xyz",
            "https://api.piped.yt",
            "https://pipedapi.reallyaweso.me",
            "https://pipedapi.adminforge.de",
            "https://nyc1.piapi.ggtyler.dev",
            "https://pol1.piapi.ggtyler.dev",
            "https://cal1.piapi.ggtyler.dev",
            "https://pipedapi.nosebs.ru",
            "https://pipedapi.orangenet.cc",
            "https://api.piped.private.coffee",
            "https://pipedapi.ducks.party",
            "https://piapi.ggtyler.dev"
        ];
        
        // Helper function to fetch all videos from a channel using Piped API
        async function fetchAllChannelVideos(channelId) {
            let allVideos = [];
            let nextpage = null;
            let totalVideos = 0;
            let pagesProcessed = 0;
            
            // Try each API in sequence if needed
            for (let apiIndex = 0; apiIndex < PIPED_APIS.length; apiIndex++) {
                try {
                    const apiBase = PIPED_APIS[apiIndex];
                    
                    // Get initial channel data
                    const channelData = await axiosInstance.get(`${apiBase}/channel/${channelId}`, {
                        timeout: 5000
                    });
                    
                    if (!channelData.data || !channelData.data.relatedStreams) {
                        throw new Error('Invalid channel data structure');
                    }
                    
                    // Filter out videos that don't meet minimum duration requirement
                    const validVideos = channelData.data.relatedStreams.filter(video => 
                        video && 
                        video.duration && 
                        video.duration >= MIN_DURATION_SECONDS
                    );
                    
                    // Extract video IDs
                    const videoIds = validVideos.map(video => {
                        // Extract video ID from URL
                        if (video.url && video.url.includes('v=')) {
                            return video.url.split('v=')[1];
                        }
                        return null;
                    }).filter(id => id !== null);
                    
                    allVideos = allVideos.concat(videoIds);
                    totalVideos += validVideos.length;
                    nextpage = channelData.data.nextpage;
                    pagesProcessed++;
                    
                    // Process up to 10 additional pages (to limit resource usage)
                    const maxPages = 10;
                    let currentPage = 0;
                    
                    while (nextpage && currentPage < maxPages) {
                        try {
                            const nextPageData = await axiosInstance.get(
                                `${apiBase}/nextpage/channel/${channelId}?nextpage=${encodeURIComponent(nextpage)}`,
                                { timeout: 5000 }
                            );
                            
                            if (!nextPageData.data || !nextPageData.data.relatedStreams) {
                                break;
                            }
                            
                            // Filter videos again
                            const validNextPageVideos = nextPageData.data.relatedStreams.filter(video => 
                                video && 
                                video.duration && 
                                video.duration >= MIN_DURATION_SECONDS
                            );
                            
                            // Extract video IDs
                            const nextPageVideoIds = validNextPageVideos.map(video => {
                                if (video.url && video.url.includes('v=')) {
                                    return video.url.split('v=')[1];
                                }
                                return null;
                            }).filter(id => id !== null);
                            
                            allVideos = allVideos.concat(nextPageVideoIds);
                            totalVideos += validNextPageVideos.length;
                            nextpage = nextPageData.data.nextpage;
                            currentPage++;
                            pagesProcessed++;
                            
                            // Add slight delay to avoid rate limiting
                            await new Promise(resolve => setTimeout(resolve, 300));
                            
                            // Stop if we've collected enough videos
                            if (allVideos.length >= 500) break;
                            
                        } catch (error) {
                            console.error(`Error fetching next page for channel ${channelId}:`, error.message);
                            break;
                        }
                    }
                    
                    // Deduplicate videos
                    allVideos = [...new Set(allVideos)];
                    
                    return {
                        status: 'ok',
                        videos: allVideos,
                        stats: {
                            totalVideos: totalVideos,
                            fetchedVideos: allVideos.length,
                            pagesProcessed: pagesProcessed
                        }
                    };
                    
                } catch (error) {
                    // If this API failed, try the next one
                    console.error(`API ${PIPED_APIS[apiIndex]} failed for channel ${channelId}:`, error.message);
                    
                    // If we've tried all APIs, give up
                    if (apiIndex === PIPED_APIS.length - 1) {
                        throw error;
                    }
                    // Otherwise, continue to the next API
                    continue;
                }
            }
            
            // If all APIs failed
            throw new Error(`All Piped API attempts failed for channel ${channelId}`);
        }
        
        // Fetch channel data using Piped API
        const channelData = await fetchAllChannelVideos(channelId);
        
        if (!channelData || channelData.status !== 'ok') {
            throw new Error('Failed to fetch channel data');
        }

        // Prepare response with the same structure as before
        res.json({
            channelId,
            totalVideos: channelData.stats.totalVideos,
            fetchedVideos: channelData.stats.fetchedVideos,
            filteredVideos: channelData.videos.length,
            videos: channelData.videos
        });
    } catch (error) {
        console.error('Error in /list endpoint:', error);
        
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Unexpected error occurred',
        message: err.message,
        code: 'UNHANDLED_ERROR'
    });
});


// Featured videos endpoint using only Piped API
// Improved featured videos endpoint with full parallel processing
// New videos endpoint using Piped API - sorted by views (highest first)
app.get('/newest', async (req, res) => {
    try {
        console.log('Fetching latest videos from all channels');
        
        // Piped API instances to try
        const PIPED_APIS = [
            "https://pipedapi.leptons.xyz",
            "https://api.piped.yt",
            "https://pipedapi.reallyaweso.me",
            "https://pipedapi.adminforge.de",
            "https://nyc1.piapi.ggtyler.dev",
            "https://pol1.piapi.ggtyler.dev",
            "https://cal1.piapi.ggtyler.dev",
            "https://pipedapi.nosebs.ru",
            "https://pipedapi.orangenet.cc",
            "https://api.piped.private.coffee",
            "https://pipedapi.ducks.party",
            "https://piapi.ggtyler.dev"
        ];
        
        // Helper function to fetch data from any available Piped API
        async function fetchFromPipedAPI(endpoint) {
            for (const apiBase of PIPED_APIS) {
                try {
                    const response = await axiosInstance.get(`${apiBase}${endpoint}`, {
                        timeout: 3000 // 3 second timeout
                    });
                    if (response.data) {
                        return response.data;
                    }
                } catch (error) {
                    // Try next API instance
                    continue;
                }
            }
            // If all APIs fail
            throw new Error(`Failed to fetch data from endpoint: ${endpoint}`);
        }
        
        // Fetch latest videos from all channels
        const allVideos = [];
        
        // Process channels in parallel with Promise.all for better performance
        const channelPromises = CHANNEL_IDS.map(async (channelId) => {
            try {
                // Get channel content from Piped
                const channelData = await fetchFromPipedAPI(`/channel/${channelId}`);
                
                if (channelData && channelData.relatedStreams) {
                    // Filter videos that meet minimum duration requirement
                    const validVideos = channelData.relatedStreams
                        .filter(video => 
                            video && 
                            video.duration && 
                            video.duration >= MIN_DURATION_SECONDS
                        );
                    
                    // Sort by upload date (descending) if available first to get latest videos
                    const sortedByDate = [...validVideos]
                        .sort((a, b) => (b.uploaded || 0) - (a.uploaded || 0));
                    
                    // Take only the 2 latest videos
                    return sortedByDate.slice(0, 2);
                }
                return [];
            } catch (error) {
                console.error(`Error fetching channel ${channelId} for /new endpoint:`, error.message);
                return [];
            }
        });
        
        // Wait for all channel fetches to complete
        const channelResults = await Promise.all(channelPromises);
        
        // Combine all videos from all channels
        channelResults.forEach(videos => {
            allVideos.push(...videos);
        });
        
        // Sort by view count in descending order
        const sortedByViews = allVideos.sort((a, b) => {
            // Ensure we're dealing with numbers - convert view counts if needed
            const viewsA = typeof a.views === 'number' ? a.views : parseInt(a.views || '0');
            const viewsB = typeof b.views === 'number' ? b.views : parseInt(b.views || '0');
            return viewsB - viewsA;
        });
        
        if (sortedByViews.length === 0) {
            return res.status(404).json({
                error: 'No new videos found',
                code: 'NO_VIDEOS'
            });
        }
        
        res.json({
            items: sortedByViews,
            totalItems: sortedByViews.length,
            message: 'Success',
            code: 'OK'
        });
        
    } catch (error) {
        console.error('New videos endpoint error:', error);
        res.status(500).json({
            error: 'Failed to fetch new videos',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});

export default app;
