# EvLens WebScraper

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.8-blue)](https://www.python.org/)

A comprehensive web scraping API for event sentiment analysis across multiple social media platforms and web sources.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Node.js Setup](#nodejs-setup)
  - [Python Setup](#python-setup)
  - [Environment Configuration](#environment-configuration)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Base URL](#base-url)
  - [Authentication](#authentication)
  - [Endpoints](#endpoints)
    - [Health Check](#health-check)
    - [Scrape Single URL](#scrape-single-url)
    - [Scrape Multiple URLs](#scrape-multiple-urls)
    - [Scrape Profile](#scrape-profile)
    - [Scrape Event](#scrape-event)
    - [Supported Platforms](#supported-platforms)
- [Request & Response Formats](#request--response-formats)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Data Export](#data-export)
- [Platform Support](#platform-support)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- Multi-platform scraping (Instagram, Twitter, LinkedIn, Reddit, News, Blogs)
- Event-based sentiment analysis across platforms
- Bulk URL processing
- Profile and user activity analysis
- JSON and CSV export formats
- Rate limiting and security measures
- Comprehensive engagement metrics
- Real-time scraping with browser automation

---

## Architecture

**Dual-Service Design**

```
┌─────────────────────┐         ┌──────────────────────┐
│   Node.js Service   │────────▶│   Python Service     │
│   (Express.js)      │         │   (Flask)            │
│   Port: 3000        │         │   Port: 5000         │
│                     │         │                      │
│ - API Routing       │         │ - Instagram Scraper  │
│ - Data Formatting   │         │ - Twitter Scraper    │
│ - Reddit Scraper    │         │ - LinkedIn Scraper   │
│ - Generic Scraper   │         │ - Playwright Engine  │
│ - Export Generator  │         │                      │
└─────────────────────┘         └──────────────────────┘
```

---

## Installation

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 16.0.0 |
| Python | ≥ 3.8 |
| npm/yarn | Latest |
| pip | Latest |

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

Create `.env` file in root directory:

```env
PORT=3000
PYTHON_API_URL=http://localhost:5000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Quick Start

**Terminal 1 - Start Node.js Server**
```bash
npm start
```

**Terminal 2 - Start Python Service**
```bash
npm run python:api
```

**Test the API**
```bash
curl http://localhost:3000/health
```

---

## API Reference

### Base URL

```
http://localhost:3000/api/scraper
```

Production: `https://your-domain.com/api/scraper`

### Authentication

Currently no authentication required. Implement before production deployment.

### Endpoints

#### Health Check

```http
GET /health
```

**Response**
```json
{
  "status": "OK",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

#### Scrape Single URL

```http
POST /api/scraper/scrape
```

**Request Body**
```json
{
  "url": "https://reddit.com/r/events/comments/abc123",
  "eventName": "Tech Conference 2025"
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Valid HTTP/HTTPS URL |
| eventName | string | Yes | Event identifier |

**Success Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "url": "string",
    "platform": "reddit",
    "event_name": "Tech Conference 2025",
    "post_text": "string",
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
      "neutral": 5
    },
    "metadata": {
      "author": "username",
      "post_type": "post",
      "hashtags": ["tech"],
      "mentions": ["user1"]
    }
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

**Error Response** `400 Bad Request`
```json
{
  "success": false,
  "error": "URL is required"
}
```

---

#### Scrape Multiple URLs

```http
POST /api/scraper/scrape-multiple
```

**Request Body**
```json
{
  "urls": [
    "https://reddit.com/r/example/comments/abc123",
    "https://example.com/article"
  ],
  "eventName": "Product Launch 2025"
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| urls | array | Yes | Array of URLs (max 50) |
| eventName | string | No | Event identifier |

**Success Response** `200 OK`
```json
{
  "success": true,
  "data": [...],
  "count": 2,
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

#### Scrape Profile

```http
POST /api/scraper/scrape-profile
```

**Request Body**
```json
{
  "profileUrl": "https://instagram.com/username",
  "platform": "instagram",
  "eventName": "Brand Campaign 2025"
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| profileUrl | string | Yes | Profile URL |
| platform | string | Yes | Platform name |
| eventName | string | No | Event identifier |

**Supported Platforms**: `instagram`, `twitter`, `linkedin`, `reddit`

**Success Response** `200 OK`
```json
{
  "profile_url": "https://instagram.com/username",
  "platform": "instagram",
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

---

#### Scrape Event

```http
POST /api/scraper/scrape-event
```

**Request Body**
```json
{
  "eventName": "Music Festival 2025",
  "eventDate": "2025-08-15",
  "platforms": ["reddit", "twitter", "news"],
  "socialLinks": {
    "instagram": "https://instagram.com/festival",
    "twitter": "https://twitter.com/festival"
  },
  "output": "json"
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventName | string | Yes | Event name |
| eventDate | string | Yes | Date (YYYY-MM-DD) |
| platforms | array | No | Platforms to search (default: all) |
| socialLinks | object | No | Platform-specific URLs |
| output | string | No | "json" or "excel" (default: json) |

**Available Platforms**: `reddit`, `twitter`, `instagram`, `linkedin`, `news`, `blogs`, `generic`

**Success Response** `200 OK`
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
        "totalEngagement": 50000,
        "postTypes": {...}
      }
    }
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

**Excel Output Response**
```json
{
  "success": true,
  "message": "Excel file generated successfully",
  "filename": "event_analysis_music_festival_2025_2025-10-04.csv",
  "filepath": "/path/to/exports/filename.csv",
  "summary": {
    "totalPosts": 150,
    "platforms": ["reddit", "twitter"],
    "totalEngagement": 125000
  }
}
```

---

#### Supported Platforms

```http
GET /api/scraper/supported-platforms
```

**Success Response** `200 OK`
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

---

## Request & Response Formats

### Standard Response Structure

**Success**
```json
{
  "success": true,
  "data": {...},
  "timestamp": "ISO 8601 string"
}
```

**Error**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "ISO 8601 string"
}
```

### Comment Object
```json
{
  "user": "string",
  "text": "string",
  "likes": "number",
  "timestamp": "string",
  "replies_count": "number"
}
```

### Engagement Object
```json
{
  "total_interactions": "number",
  "likes": "number",
  "comments": "number",
  "shares": "number",
  "engagement_rate": "string | null"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 501 | Not Implemented |

### Common Errors

**Invalid URL Format**
```json
{
  "success": false,
  "error": "Invalid URL format"
}
```

**Unsupported Platform**
```json
{
  "success": false,
  "error": "Unsupported platform: facebook"
}
```

**Rate Limit Exceeded**
```json
{
  "success": false,
  "error": "Too many requests from this IP"
}
```

**Python Service Unavailable**
```json
{
  "success": false,
  "error": "Python scraper service unavailable. Please ensure it is running."
}
```

**Invalid Date Format**
```json
{
  "success": false,
  "error": "Invalid event date format. Use YYYY-MM-DD"
}
```

---

## Rate Limiting

**Default Configuration**

- Window: 15 minutes
- Max Requests: 100 per IP
- Response: HTTP 429 with error message

**Custom Configuration** (`.env`)
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Data Export

### JSON Format
Default output with complete data structure.

### CSV/Excel Format
Request with `"output": "excel"` parameter.

**CSV Columns**
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

**Export Location**: `exports/` directory

---

## Platform Support

| Platform | Features | Method |
|----------|----------|--------|
| Reddit | Posts, comments, subreddits | Direct API |
| Twitter | Tweets, profiles, searches | Playwright |
| Instagram | Posts, reels, profiles | Playwright |
| LinkedIn | Posts, profiles, reactions | Playwright |
| Generic Web | Articles, blogs | Cheerio |
| News Sites | Articles | Mock (implement API) |
| Blogs | Posts | Mock (implement API) |

---

## Deployment

### Production Environment Variables

```env
PORT=3000
PYTHON_API_URL=http://python-service:5000
NODE_ENV=production
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=error
```

### Security Checklist

- [ ] Enable HTTPS/SSL
- [ ] Implement authentication
- [ ] Configure CORS properly
- [ ] Set secure environment variables
- [ ] Enable production logging
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up monitoring and alerts
- [ ] Regular security updates

---

## Troubleshooting

### Python Service Not Responding

**Error**: `Python scraper service unavailable`

**Solution**:
```bash
python python_scrapers/scraper_api.py
```
Verify Python service runs on port 5000

### Playwright Browser Issues

**Error**: `Browser executable not found`

**Solution**:
```bash
playwright install
```

### Rate Limit Issues

**Error**: `Too many requests from this IP`

**Solution**: Wait 15 minutes or adjust rate limits in configuration

### Timeout Errors

**Error**: `Timeout waiting for selector`

**Solution**: Increase timeout in `src/config/scraperConfig.js`

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

**Repository**: [EvLens-WebScraper](https://github.com/1DeepanshuPathak1/EvLens-WebScraper)

**Issues**: [Report Issues](https://github.com/1DeepanshuPathak1/EvLens-WebScraper/issues)
