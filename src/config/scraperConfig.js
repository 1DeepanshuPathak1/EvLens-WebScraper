module.exports = {
  platforms: {
    instagram: {
      patterns: [/instagram\.com/, /instagr\.am/],
      selectors: {
        postText: 'article h1, article span',
        comments: 'article ul li',
        likes: 'section button span',
        timestamp: 'time'
      }
    },
    twitter: {
      patterns: [/twitter\.com/, /x\.com/],
      selectors: {
        postText: '[data-testid="tweetText"]',
        comments: '[data-testid="reply"]',
        likes: '[data-testid="like"]',
        retweets: '[data-testid="retweet"]',
        timestamp: 'time'
      }
    },
    reddit: {
      patterns: [/reddit\.com/],
      selectors: {
        postText: '[data-test-id="post-content"]',
        comments: '[data-testid="comment"]',
        upvotes: '[aria-label*="upvote"]',
        timestamp: 'time'
      }
    },
    linkedin: {
      patterns: [/linkedin\.com/],
      selectors: {
        postText: '.feed-shared-text',
        comments: '.comments-comment-item',
        reactions: '.social-details-social-counts',
        timestamp: 'time'
      }
    }
  },
  scraping: {
    timeout: 30000,
    waitForSelector: 5000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    retryAttempts: 3,
    retryDelay: 2000
  },
  pythonApi: {
    baseUrl: process.env.PYTHON_API_URL || 'http://localhost:5000',
    timeout: 60000
  }
};