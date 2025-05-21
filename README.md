# Podcast API Documentation

Base URL: `https://backendmix.vercel.app`

## Available Endpoints

### Media Services
- `GET /video/{videoId}` - Get video stream
- `GET /audio/{videoId}` - Get audio stream
- `GET /videoaud/{videoId}` - Get video with audio

### Channel Services
- `GET /search?q={query}` - Search podcasts
- `GET /channel/{channelId}` - Get channel information
- `GET /channel/{channelId}/more/{nextPageToken}` - Load more episodes
- `GET /featured` - Get featured podcasts
- `GET /newest` - Get newest podcasts
- `GET /c/{channelId}` - Get all channel videos

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/status` - Check auth status

### System
- `GET /health` - System health check
- `GET /database/check` - Database health check
- `GET /cobalt/health` - Cobalt service health check
- `GET /ips` - Get proxy IPs
- `GET /stats` - Get proxy stats
- `GET /proxyElite` - Get ProxyElite proxies

## Detailed Documentation

### Media Services

#### Get Video Stream
```http
GET /video/{videoId}
```
Returns video stream URL for a podcast episode.

**Parameters**:
- `videoId`: Episode ID (required)

**Response**:
```json
{
  "status": "success",
  "url": "stream_url",
  "filename": "episode_title",
  "quality": "360p",
  "hasAudio": true,
  "note": "optional_note",
  "format": "video"
}
```

#### Get Audio Stream
```http
GET /audio/{videoId}
```
Returns audio-only stream URL for a podcast episode.

**Parameters**:
- `videoId`: Episode ID (required)

**Response**:
```json
{
  "status": "success",
  "url": "audio_url",
  "filename": "episode_title",
  "format": "audio"
}
```

#### Get Video with Audio
```http
GET /videoaud/{videoId}
```
Returns video stream URL with audio for a podcast episode.

**Parameters**:
- `videoId`: Episode ID (required)

**Response**:
```json
{
  "status": "success",
  "url": "stream_url",
  "filename": "episode_title",
  "quality": "360p",
  "note": "optional_note",
  "format": "video"
}
```

### Channel Services

#### Search Podcasts
```http
GET /search?q={query}
```
Search for podcasts by keyword.

**Query Parameters**:
- `q`: Search query (required)

**Response**:
```json
{
  "items": [
    {
      "title": "podcast_title",
      "author": "channel_name",
      "videoId": "video_id",
      "lengthSeconds": "duration",
      "viewCount": "views",
      "published": "timestamp"
    }
  ],
  "message": "Success",
  "code": "OK"
}
```

#### Get Channel Information
```http
GET /channel/{channelId}
```
Get channel information and episodes.

**Parameters**:
- `channelId`: Channel ID (required)

**Response**:
```json
{
  "status": "ok",
  "channelInfo": {
    "name": "channel_name",
    "description": "channel_description",
    "subscriberCount": "subscriber_count",
    "videoCount": "video_count"
  },
  "stats": {
    "totalVideos": "total_count",
    "fetchedVideos": "fetched_count"
  },
  "videos": [
    {
      "title": "video_title",
      "videoId": "video_id",
      "lengthSeconds": "duration",
      "viewCount": "views",
      "published": "timestamp"
    }
  ]
}
```

#### Load More Episodes
```http
GET /channel/{channelId}/more/{nextPageToken}
```
Get additional episodes from a channel.

**Parameters**:
- `channelId`: Channel ID (required)
- `nextPageToken`: Pagination token (required)

**Response**:
```json
{
  "nextpage": "next_page_token",
  "relatedStreams": [
    {
      "title": "video_title",
      "videoId": "video_id",
      "lengthSeconds": "duration",
      "viewCount": "views",
      "published": "timestamp"
    }
  ],
  "message": "Success",
  "code": "OK"
}
```

#### Get All Channel Videos
```http
GET /c/{channelId}
```
Get all videos from a channel with Server-Sent Events support.

**Parameters**:
- `channelId`: Channel ID (required)

**Response**:
```json
{
  "status": "ok",
  "channelInfo": {
    "name": "channel_name",
    "description": "channel_description"
  },
  "stats": {
    "totalVideos": "total_count",
    "fetchedVideos": "fetched_count"
  },
  "videos": [
    {
      "title": "video_title",
      "videoId": "video_id",
      "lengthSeconds": "duration",
      "viewCount": "views",
      "published": "timestamp"
    }
  ]
}
```

#### Get Featured Podcasts
```http
GET /featured
```
Get curated list of featured podcasts.

**Response**:
```json
{
  "status": "ok",
  "featured": [
    {
      "title": "podcast_title",
      "author": "channel_name",
      "videoId": "video_id",
      "thumbnail": "thumbnail_url",
      "description": "podcast_description"
    }
  ]
}
```

#### Get Newest Podcasts
```http
GET /newest
```
Get latest podcast episodes.

**Response**:
```json
{
  "status": "ok",
  "videos": [
    {
      "title": "video_title",
      "author": "channel_name",
      "videoId": "video_id",
      "lengthSeconds": "duration",
      "viewCount": "views",
      "published": "timestamp"
    }
  ]
}
```

### Authentication

#### Register User
```http
POST /auth/register
```
Create a new user account.

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "phone": "1234567890"
}
```

**Response**:
```json
{
  "status": "success",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "jwt_token"
}
```

#### Login User
```http
POST /auth/login
```
Authenticate a user.

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "status": "success",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "jwt_token"
}
```

#### Check Auth Status
```http
GET /auth/status
```
Check current authentication status.

**Response**:
```json
{
  "status": "success",
  "authenticated": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### System

#### Health Check
```http
GET /health
```
Check system health status.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-03-21T12:00:00Z",
  "service": "Raag API wrapper",
  "currentInstance": "instance_url"
}
```

#### Database Health Check
```http
GET /database/check
```
Check database connection status.

**Response**:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-03-21T12:00:00Z"
}
```

#### Cobalt Health Check
```http
GET /cobalt/health
```
Check Cobalt service status.

**Response**:
```json
{
  "status": "ok",
  "version": "version_number",
  "services": ["service_list"],
  "durationLimit": "limit_value"
}
```

#### Get Proxy IPs
```http
GET /ips
```
Get list of proxy IPs.

**Response**:
```json
{
  "proxies": [
    "ip:port",
    "ip:port"
  ]
}
```

#### Get Proxy Stats
```http
GET /stats
```
Get statistics about available proxies.

**Response**:
```json
{
  "total": "total_proxies",
  "timestamp": "2024-03-21T12:00:00Z"
}
```

#### Get ProxyElite Proxies
```http
GET /proxyElite
```
Get proxies from ProxyElite service.

**Response**:
```json
{
  "proxies": [
    "ip:port",
    "ip:port"
  ],
  "count": "proxy_count"
}
```

## Error Handling

All endpoints follow a standard error response format:

```json
{
  "status": "error",
  "error": {
    "code": "error_code",
    "message": "Error description"
  }
}
```

Common error codes:
- `missing_video_id`: Video ID not provided
- `missing_channel_id`: Channel ID not provided
- `fetch_failed`: Failed to fetch data
- `processing_failed`: Failed to process request
- `channel_fetch_failed`: Failed to fetch channel videos
- `INTERNAL_ERROR`: Internal server error

## Notes

- All endpoints require HTTPS
- Authentication is required for protected endpoints
- All timestamps are in ISO 8601 format
- Response times may vary based on server load
- Server-Sent Events (SSE) are supported for long-running operations
- CORS is enabled for all endpoints
- Rate limiting is implemented to prevent abuse
