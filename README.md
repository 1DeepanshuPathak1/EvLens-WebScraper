# EvLens WebScraper

A comprehensive web scraping API designed for event sentiment analysis across multiple social media platforms and web sources. This service combines Node.js and Python to extract, process, and analyze social media content related to events.

## Overview

EvLens WebScraper is a dual-service architecture that enables scraping of social media posts, comments, and engagement metrics from platforms including Instagram, Twitter, LinkedIn, Reddit, news sites, and blogs. The system is built to analyze public sentiment and engagement around specific events.

## Features

### Multi-Platform Support

- **Instagram**: Post content, comments, likes, profile data, and reels
- **Twitter**: Tweets, replies, retweets, likes, and profile information
- **LinkedIn**: Posts, reactions, comments, and professional content
- **Reddit**: Posts, comments, upvotes, awards, and subreddit data
- **Generic Web**: Articles, blog posts, and general web content
- **News Sources**: News articles and coverage
- **Blog Platforms**: Blog posts and reviews

### Core Capabilities

- Single URL scraping with detailed metadata extraction
- Bulk URL scraping for multiple sources simultaneously
- Profile scraping to analyze user activity and engagement
- Event-based scraping across multiple platforms
- Sentiment analysis based on comment content
- Engagement metrics calculation and aggregation
- Export functionality in JSON and CSV formats
- Rate limiting and request throttling
- Comprehensive error handling and logging

## Architecture

### Node.js Service

The primary API server built with Express.js handles:

- HTTP request routing and validation
- Rate limiting and security measures
- Data formatting and aggregation
- CSV/Excel export generation
- Reddit and generic web scraping
- Orchestration of Python scrapers

### Python Service

A Flask-based microservice specialized in:

- Instagram scraping using Playwright
- Twitter scraping with browser automation
- LinkedIn content extraction
- Complex JavaScript-rendered page handling

## Installation

### Prerequisites

- Node.js 16.x or higher
- Python 3.8 or higher
- npm or yarn package manager
- pip package manager

### Node.js Setup

```bash
npm install
```

### Python Setup

```bash
cd python_scrapers
pip install -r requirements.txt
playwright install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=3000
PYTHON_API_URL=http://localhost:5000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Running the Services

### Start Node.js API Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### Start Python Scraper Service

```bash
npm run python:api
```

Or directly:

```bash
python python_scrapers/scraper_api.py
```

Both services must be running simultaneously for full functionality.

## API Documentation

### Base URL

```
http://localhost:3000/api/scraper
```

### Endpoints

#### Health Check

```http
GET /health
```

Returns the operational status of the Node.js service.

**Response**

```json
{
  "status": "OK",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

#### Scrape Single URL

```http
POST /api/scraper/scrape
```

Extract content from a single social media post or web page.

**Request Body**

```json
{
  "url": "https://reddit.com/r/example/comments/abc123",
  "eventName": "Tech Conference 2025"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "url": "https://reddit.com/r/example/comments/abc123",
    "platform": "reddit",
    "event_name": "Tech Conference 2025",
    "post_text": "Post title and content",
    "comments": [...],
    "likes": 150,
    "shares": 25,
    "timestamp": "2025-10-04T10:30:00.000Z",
    "engagement": {
      "total_interactions": 200,
      "likes": 150,
      "comments": 25,
      "shares": 25
    },
    "sentiment_data": {
      "positive": 15,
      "negative": 5,
      "neutral": 5,
      "total": 25
    },
    "metadata": {
      "author": "username",
      "post_type": "post",
      "hashtags": ["tech", "conference"],
      "mentions": ["user1", "user2"]
    }
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

#### Scrape Multiple URLs

```http
POST /api/scraper/scrape-multiple
```

Scrape multiple URLs in a single request.

**Request Body**

```json
{
  "urls": [
    "https://reddit.com/r/example/comments/abc123",
    "https://twitter.com/user/status/123456789",
    "https://linkedin.com/posts/activity-123"
  ],
  "eventName": "Product Launch 2025"
}
```

**Response**

```json
{
  "success": true,
  "data": [...],
  "count": 3,
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

#### Scrape Profile

```http
POST /api/scraper/scrape-profile
```

Scrape user profile information and recent posts.

**Request Body**

```json
{
  "profileUrl": "https://instagram.com/username",
  "platform": "instagram",
  "eventName": "Brand Campaign 2025"
}
```

**Response**

```json
{
  "profile_url": "https://instagram.com/username",
  "platform": "instagram",
  "event_name": "Brand Campaign 2025",
  "profile_data": {
    "username": "username",
    "followers": 15000,
    "following": 500,
    "posts_count": 250
  },
  "posts": [...],
  "overall_sentiment": {
    "positive": 120,
    "negative": 30,
    "neutral": 100,
    "positive_percentage": "48.00"
  },
  "engagement_metrics": {
    "total_posts": 10,
    "total_likes": 5000,
    "total_comments": 500,
    "avg_likes_per_post": "500.00"
  }
}
```

#### Scrape Event

```http
POST /api/scraper/scrape-event
```

Comprehensive event analysis across multiple platforms.

**Request Body**

```json
{
  "eventName": "Music Festival 2025",
  "eventDate": "2025-08-15",
  "platforms": ["reddit", "twitter", "instagram", "news"],
  "socialLinks": {
    "instagram": "https://instagram.com/festivalofficial",
    "twitter": "https://twitter.com/festival2025"
  },
  "output": "json"
}
```

**Parameters**

- `eventName` (required): Name of the event to analyze
- `eventDate` (required): Event date in YYYY-MM-DD format
- `platforms` (optional): Array of platforms to search. Default: all platforms
- `socialLinks` (optional): Object with platform-specific URLs
- `output` (optional): Response format - "json" or "excel". Default: "json"

**Response**

```json
{
  "success": true,
  "data": {
    "eventName": "Music Festival 2025",
    "eventDate": "2025-08-15",
    "scrapingPeriod": {
      "start": "2025-08-15T00:00:00.000Z",
      "end": "2025-11-15T00:00:00.000Z"
    },
    "results": [...],
    "failedPlatforms": [],
    "totalEngagement": 125000,
    "platforms": {
      "reddit": {
        "totalPosts": 150,
        "totalEngagement": 50000
      },
      "twitter": {
        "totalPosts": 200,
        "totalEngagement": 75000
      }
    }
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

#### Get Supported Platforms

```http
GET /api/scraper/supported-platforms
```

List all supported platforms.

**Response**

```json
{
  "success": true,
  "platforms": [
    "instagram",
    "twitter",
    "reddit",
    "linkedin",
    "generic"
  ],
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### Python Service Endpoints

The Python service runs on port 5000 and provides specialized scrapers.

#### Health Check

```http
GET http://localhost:5000/health
```

#### Scrape Post

```http
POST http://localhost:5000/scrape
```

**Request Body**

```json
{
  "url": "https://instagram.com/p/abc123",
  "platform": "instagram",
  "event_name": "Event Name"
}
```

#### Scrape Profile

```http
POST http://localhost:5000/scrape-profile
```

#### Search Posts

```http
POST http://localhost:5000/search-posts
```

**Request Body**

```json
{
  "hashtag": "#festival2025",
  "platform": "instagram",
  "event_name": "Music Festival",
  "limit": 50
}
```

## Data Models

### Post Object

```json
{
  "url": "string",
  "platform": "string",
  "post_text": "string",
  "author": "string",
  "comments": [
    {
      "user": "string",
      "text": "string",
      "likes": "number",
      "timestamp": "string"
    }
  ],
  "likes": "number",
  "shares": "number",
  "timestamp": "string",
  "engagement": {
    "total_interactions": "number",
    "likes": "number",
    "comments": "number",
    "shares": "number"
  },
  "metadata": {
    "author": "string",
    "post_type": "string",
    "hashtags": ["string"],
    "mentions": ["string"]
  }
}
```

### Profile Object

```json
{
  "username": "string",
  "followers": "number",
  "following": "number",
  "posts_count": "number",
  "posts": ["Post[]"],
  "overall_sentiment": {
    "positive": "number",
    "negative": "number",
    "neutral": "number",
    "positive_percentage": "string"
  }
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message description",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### Common HTTP Status Codes

- `200`: Success
- `400`: Bad Request - Invalid parameters
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error
- `501`: Not Implemented

## Rate Limiting

Default rate limits apply to all endpoints:

- **Window**: 15 minutes (900,000 milliseconds)
- **Max Requests**: 100 per window
- **Response**: 429 status with error message

Configure in `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Export Formats

### JSON Export

Default format with complete data structure.

### Excel/CSV Export

Request with `"output": "excel"` to receive:

- Flattened data structure
- CSV file generation
- Saved to `exports/` directory
- Summary statistics included

CSV columns:

- eventName
- eventDate
- platform
- postType
- content
- url
- author
- likes
- comments
- shares
- sentiment
- postDate
- engagement

## Logging

Logs are stored in the `logs/` directory:

- `error.log`: Error-level logs only
- `combined.log`: All log levels

Log format includes:

- Timestamp
- Log level
- Service name
- Message
- Stack traces for errors

## Security

### Implemented Measures

- Helmet.js for HTTP header security
- CORS configuration
- Rate limiting
- Input validation
- URL sanitization
- Request timeout enforcement

### Best Practices

- Never commit `.env` files
- Rotate API keys regularly
- Use HTTPS in production
- Implement authentication for production deployment
- Monitor rate limit abuse
- Regular security updates

## Deployment

### Production Considerations

1. **Environment Variables**: Set production values for all environment variables
2. **Process Management**: Use PM2 or similar for Node.js process management
3. **Reverse Proxy**: Configure nginx or Apache as reverse proxy
4. **SSL/TLS**: Implement HTTPS with valid certificates
5. **Database**: Consider adding database for caching and analytics
6. **Monitoring**: Implement application monitoring and alerting
7. **Scaling**: Configure load balancing for horizontal scaling

### Docker Deployment

Create `Dockerfile` for containerization:

```dockerfile
FROM node:16

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Configuration

Production `.env` example:

```env
PORT=3000
PYTHON_API_URL=http://python-scraper:5000
NODE_ENV=production
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=error
```

## Troubleshooting

### Python Service Connection Failed

**Error**: `Python scraper service unavailable`

**Solution**: Ensure Python service is running on configured port

```bash
python python_scrapers/scraper_api.py
```

### Playwright Installation Issues

**Error**: Browser executable not found

**Solution**: Install Playwright browsers

```bash
playwright install
```

### Rate Limit Exceeded

**Error**: `Too many requests from this IP`

**Solution**: Wait for rate limit window to reset or adjust limits in configuration

### Scraping Timeout

**Error**: Timeout waiting for selector

**Solution**: Increase timeout in `src/config/scraperConfig.js`

## Limitations

### Platform Limitations

- **Instagram**: Requires authentication for private accounts
- **Twitter**: API rate limits apply
- **LinkedIn**: Limited to public posts
- **Reddit**: Subject to Reddit API terms

### Technical Limitations

- JavaScript-heavy sites require Python service
- Some platforms may implement anti-scraping measures
- Rate limits prevent excessive requests
- Browser automation increases resource usage

## Contributing

Contributions are welcome. Please ensure:

- Code follows existing style conventions
- All tests pass
- Documentation is updated
- Commit messages are descriptive

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions:

- GitHub Issues: [Repository Issues](https://github.com/1DeepanshuPathak1/EvLens-WebScraper/issues)
- Repository: [EvLens-WebScraper](https://github.com/1DeepanshuPathak1/EvLens-WebScraper)

## Version History

### 1.0.0

- Initial release
- Multi-platform scraping support
- Event-based analysis
- Excel export functionality
- Comprehensive API documentation
