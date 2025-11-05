const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config/scraperConfig');
const logger = require('../../utils/logger');

const genericScraper = {
  async scrape(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': config.scraping.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: config.scraping.timeout,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);
      
      $('script, style, nav, header, footer, .ad, .advertisement').remove();
      
      const title = this.extractTitle($);
      const content = this.extractContent($);
      const comments = this.extractComments($);
      const author = this.extractAuthor($);
      const timestamp = this.extractTimestamp($);
      const metadata = this.extractMetadata($);

      return {
        post_text: title,
        content: content,
        comments: comments,
        images: [],
        links: [],
        timestamp: timestamp,
        author: author,
        likes: 0,
        shares: 0,
        engagement: {
          likes: 0,
          comments: comments.length,
          shares: 0
        },
        metadata: {
          ...metadata,
          word_count: content.split(' ').length,
          url: url
        }
      };
    } catch (error) {
      logger.error(`Generic scraping error for ${url}: ${error.message}`);
      return { error: error.message };
    }
  },

  extractTitle($) {
    const titleSelectors = [
      'h1',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title',
      '.post-title',
      '.article-title',
      '[class*="title"]'
    ];
    
    for (const selector of titleSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const text = el.attr('content') || el.text().trim();
        if (text && text.length > 5) {
          return text;
        }
      }
    }
    
    return 'Untitled';
  },

  extractContent($) {
    const contentSelectors = [
      'article',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.content',
      'main',
      '[role="main"]'
    ];
    
    let content = '';
    
    for (const selector of contentSelectors) {
      const container = $(selector).first();
      if (container.length) {
        const paragraphs = [];
        container.find('p').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 50) {
            paragraphs.push(text);
          }
        });
        
        if (paragraphs.length > 0) {
          content = paragraphs.join('\n');
          break;
        }
      }
    }
    
    if (!content) {
      const paragraphs = [];
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          paragraphs.push(text);
        }
      });
      content = paragraphs.slice(0, 20).join('\n');
    }
    
    return content || 'No content extracted';
  },

  extractComments($) {
    const comments = [];
    const commentSelectors = [
      '.comment',
      '.comment-item',
      '.comment-body',
      '[class*="comment"]',
      '[id*="comment"]',
      '.discussion-item',
      '.reply'
    ];
    
    const seenTexts = new Set();
    
    commentSelectors.forEach(selector => {
      $(selector).each((i, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        if (text.length > 20 && text.length < 2000 && !seenTexts.has(text)) {
          seenTexts.add(text);
          
          const authorEl = $el.find('.author, .comment-author, [class*="author"]').first();
          const author = authorEl.text().trim() || 'Anonymous';
          
          const dateEl = $el.find('time, .date, [class*="date"]').first();
          const date = dateEl.attr('datetime') || dateEl.text().trim();
          
          comments.push({
            user: author,
            text: text,
            likes: 0,
            timestamp: date ? this.parseDate(date) : new Date().toISOString(),
            replies_count: 0
          });
        }
      });
    });

    return comments.slice(0, 100);
  },

  extractAuthor($) {
    const authorSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      '[rel="author"]',
      '.author',
      '.author-name',
      '[class*="author"]',
      '[itemprop="author"]'
    ];
    
    for (const selector of authorSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const author = el.attr('content') || el.text().trim();
        if (author && author.length > 0 && author.length < 100) {
          return author;
        }
      }
    }
    
    return 'Unknown';
  },

  extractTimestamp($) {
    const dateSelectors = [
      'time[datetime]',
      'meta[property="article:published_time"]',
      'meta[name="publish-date"]',
      '.publish-date',
      '.post-date',
      '[class*="date"]',
      '[itemprop="datePublished"]'
    ];
    
    for (const selector of dateSelectors) {
      const el = $(selector).first();
      if (el.length) {
        const date = el.attr('datetime') || el.attr('content') || el.text().trim();
        if (date) {
          try {
            return new Date(date).toISOString();
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    const bodyText = $('body').text();
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /\d{4}-\d{2}-\d{2}/,
      /\d{2}\/\d{2}\/\d{4}/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    ];
    
    for (const pattern of datePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        try {
          return new Date(match[0]).toISOString();
        } catch (e) {
          continue;
        }
      }
    }
    
    return new Date().toISOString();
  },

  extractMetadata($) {
    const metadata = {};
    
    metadata.description = $('meta[name="description"]').attr('content') || '';
    metadata.keywords = $('meta[name="keywords"]').attr('content') || '';
    metadata.language = $('html').attr('lang') || 'en';
    
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    
    if (ogTitle) metadata.og_title = ogTitle;
    if (ogDescription) metadata.og_description = ogDescription;
    if (ogImage) metadata.og_image = ogImage;
    
    return metadata;
  },

  parseDate(dateString) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
    }
    return new Date().toISOString();
  }
};

module.exports = genericScraper;