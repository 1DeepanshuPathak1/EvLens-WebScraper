const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config/scraperConfig');
const logger = require('../../utils/logger');

const genericScraper = {
  async scrape(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': config.scraping.userAgent
        },
        timeout: config.scraping.timeout
      });

      const $ = cheerio.load(response.data);
      
      const title = $('h1').first().text() || $('title').text();
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      
      const paragraphs = [];
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });

      const comments = this.extractComments($);
      const images = this.extractImages($);
      const links = this.extractLinks($, url);

      return {
        post_text: title + '\n' + metaDescription,
        content: paragraphs.join('\n'),
        comments,
        images,
        links,
        timestamp: this.extractTimestamp($),
        author: this.extractAuthor($),
        metadata: {
          word_count: paragraphs.join(' ').split(' ').length,
          paragraph_count: paragraphs.length
        }
      };
    } catch (error) {
      logger.error(`Generic scraping error: ${error.message}`);
      return { error: error.message };
    }
  },

  extractComments($) {
    const comments = [];
    const commentSelectors = ['.comment', '.comment-item', '[class*="comment"]', 'article'];
    
    commentSelectors.forEach(selector => {
      $(selector).each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 10 && text.length < 1000) {
          comments.push({
            user: 'Anonymous',
            text: text,
            likes: 0
          });
        }
      });
    });

    return comments.slice(0, 50);
  },

  extractImages($) {
    const images = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('icon') && !src.includes('logo')) {
        images.push(src);
      }
    });
    return images.slice(0, 10);
  },

  extractLinks($, baseUrl) {
    const links = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        links.push(href);
      }
    });
    return [...new Set(links)].slice(0, 20);
  },

  extractTimestamp($) {
    const timeEl = $('time').first().attr('datetime');
    if (timeEl) return new Date(timeEl).toISOString();
    
    const datePatterns = [
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{2})\/(\d{2})\/(\d{4})/
    ];
    
    const bodyText = $('body').text();
    for (const pattern of datePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        return new Date(match[0]).toISOString();
      }
    }
    
    return new Date().toISOString();
  },

  extractAuthor($) {
    const authorSelectors = [
      'meta[name="author"]',
      '[rel="author"]',
      '.author',
      '[class*="author"]'
    ];
    
    for (const selector of authorSelectors) {
      const author = $(selector).first().attr('content') || $(selector).first().text();
      if (author && author.trim()) {
        return author.trim();
      }
    }
    
    return 'Unknown';
  }
};

module.exports = genericScraper;