const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');
const config = require('../../config/scraperConfig');

const twitterScraper = {
  async searchEvent(eventName, startDate, endDate) {
    try {
      logger.info(`Searching Twitter for event: ${eventName}`);
      
      const posts = [];
      
      const searchMethods = [
        () => this.searchViaSyndication(eventName, startDate, endDate),
        () => this.searchViaGoogleCache(eventName, startDate, endDate)
      ];
      
      for (const searchMethod of searchMethods) {
        try {
          const results = await searchMethod();
          if (results && results.length > 0) {
            posts.push(...results);
            logger.info(`Found ${results.length} tweets using alternative method`);
            break;
          }
        } catch (error) {
          logger.error(`Twitter search method failed: ${error.message}`);
          continue;
        }
      }
      
      return {
        platform: 'twitter',
        query: eventName,
        timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        posts: posts,
        totalResults: posts.length
      };
    } catch (error) {
      logger.error(`Twitter search error: ${error.message}`);
      return {
        platform: 'twitter',
        posts: [],
        totalResults: 0
      };
    }
  },

  async searchViaSyndication(eventName, startDate, endDate) {
    try {
      const searchQuery = encodeURIComponent(eventName);
      const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/search?q=${searchQuery}`;
      
      const response = await axios.get(syndicationUrl, {
        headers: {
          'User-Agent': config.scraping.userAgent,
          'Accept': 'application/json',
          'Referer': 'https://platform.twitter.com/'
        },
        timeout: config.scraping.timeout
      });

      if (response.data && response.data.timeline) {
        return this.parseSyndicationResponse(response.data, startDate, endDate);
      }

      return [];
    } catch (error) {
      logger.error(`Syndication search failed: ${error.message}`);
      return [];
    }
  },

  async searchViaGoogleCache(eventName, startDate, endDate) {
    try {
      const searchQuery = encodeURIComponent(`${eventName} site:twitter.com`);
      const googleUrl = `https://www.google.com/search?q=${searchQuery}&num=100&tbm=nws`;
      
      const response = await axios.get(googleUrl, {
        headers: {
          'User-Agent': config.scraping.userAgent,
          'Accept': 'text/html'
        },
        timeout: config.scraping.timeout
      });

      const $ = cheerio.load(response.data);
      const tweets = [];

      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('twitter.com') && href.includes('/status/')) {
          const text = $(el).closest('.g, .Gx5Zad').find('.st, .IsZvec').text();
          const date = $(el).closest('.g, .Gx5Zad').find('.f, .WG9SHc span').text();
          
          if (text) {
            tweets.push({
              id: `twitter_${Date.now()}_${i}`,
              text: text,
              url: href,
              engagement: {
                likes: 0,
                retweets: 0,
                replies: 0
              },
              postDate: this.parseDate(date) || new Date().toISOString(),
              author: 'unknown',
              type: 'tweet',
              platform: 'twitter'
            });
          }
        }
      });

      return tweets;
    } catch (error) {
      logger.error(`Google cache search failed: ${error.message}`);
      return [];
    }
  },

  parseSyndicationResponse(data, startDate, endDate) {
    const tweets = [];
    
    if (data.timeline && Array.isArray(data.timeline)) {
      data.timeline.forEach((item, i) => {
        if (item.text) {
          const postDate = item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString();
          
          if (new Date(postDate) >= startDate && new Date(postDate) <= endDate) {
            tweets.push({
              id: item.id_str || `twitter_${Date.now()}_${i}`,
              text: item.text,
              engagement: {
                likes: item.favorite_count || 0,
                retweets: item.retweet_count || 0,
                replies: item.reply_count || 0
              },
              postDate: postDate,
              author: item.user?.screen_name || 'unknown',
              type: 'tweet',
              platform: 'twitter'
            });
          }
        }
      });
    }
    
    return tweets;
  },

  parseDate(dateString) {
    if (!dateString) return null;
    
    const patterns = [
      /(\d{1,2})\s+(hours?|hrs?|minutes?|mins?)\s+ago/i,
      /(\d{1,2})\s+(days?)\s+ago/i,
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/
    ];
    
    for (const pattern of patterns) {
      const match = dateString.match(pattern);
      if (match) {
        try {
          if (match[0].includes('ago')) {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            const date = new Date();
            
            if (unit.includes('hour') || unit.includes('hr')) {
              date.setHours(date.getHours() - value);
            } else if (unit.includes('minute') || unit.includes('min')) {
              date.setMinutes(date.getMinutes() - value);
            } else if (unit.includes('day')) {
              date.setDate(date.getDate() - value);
            }
            
            return date.toISOString();
          } else {
            return new Date(match[0]).toISOString();
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return null;
  },

  extractNumber(text, keyword) {
    const regex = new RegExp(`(\\d+(?:,\\d+)*)\\s*${keyword}`, 'i');
    const match = text.match(regex);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return 0;
  },

  async scrape(url) {
    logger.warn('Direct Twitter URL scraping requires Python service with Playwright');
    return { 
      error: 'Direct Twitter URL scraping not available. Use Python service or searchEvent method.' 
    };
  }
};

module.exports = twitterScraper;