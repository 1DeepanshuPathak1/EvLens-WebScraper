const axios = require('axios');
const platformDetector = require('./platformDetector');
const dataFormatter = require('./dataFormatter');
const config = require('../config/scraperConfig');
const logger = require('../utils/logger');

// Import core scrapers
const instagramScraper = require('./scrapers/instagramScraper');
const twitterScraper = require('./scrapers/twitterScraper');
const redditScraper = require('./scrapers/redditScraper');
const linkedinScraper = require('./scrapers/linkedinScraper');
const genericScraper = require('./scrapers/genericScraper');

// Import additional scrapers with fallback for development
let newsScraper, blogScraper;
try {
    newsScraper = require('./scrapers/newsScraper');
    blogScraper = require('./scrapers/blogScraper');
} catch (error) {
    logger.warn('News and Blog scrapers not fully implemented yet. Using mock data.');
    newsScraper = {
        searchEvent: async () => ({ posts: [], totalResults: 0, platform: 'news' })
    };
    blogScraper = {
        searchEvent: async () => ({ posts: [], totalResults: 0, platform: 'blogs' })
    };
}

const scraperService = {
  calculateTotalEngagement(results) {
    return results.reduce((total, result) => {
      const posts = result.posts || [];
      return total + posts.reduce((postTotal, post) => {
        const engagement = post.engagement || {};
        return postTotal + (
          (engagement.likes || 0) + 
          (engagement.comments * 2 || 0) + 
          (engagement.shares * 3 || 0)
        );
      }, 0);
    }, 0);
  },

  summarizePlatformResults(results) {
    return results.reduce((summary, result) => {
      const platform = result.platform;
      if (!summary[platform]) {
        summary[platform] = {
          totalPosts: 0,
          totalEngagement: 0,
          postTypes: {}
        };
      }

      const posts = result.posts || [];
      summary[platform].totalPosts += posts.length;
      
      posts.forEach(post => {
        const engagement = post.engagement || {};
        summary[platform].totalEngagement += (
          (engagement.likes || 0) + 
          (engagement.comments * 2 || 0) + 
          (engagement.shares * 3 || 0)
        );

        const type = post.type || 'unknown';
        summary[platform].postTypes[type] = (summary[platform].postTypes[type] || 0) + 1;
      });

      return summary;
    }, {});
  },

  async scrapeUrl(url, eventName = '') {
    const platform = platformDetector.detectPlatform(url);
    const postType = platformDetector.detectPostType(url);
    
    logger.info(`Platform detected: ${platform}, Post type: ${postType}`);
    
    let rawData;
    
    if (platform === 'instagram' || platform === 'twitter' || platform === 'linkedin') {
      rawData = await this.callPythonScraper(url, platform, eventName);
    } else {
      switch (platform) {
        case 'reddit':
          rawData = await redditScraper.scrape(url);
          break;
        case 'generic':
          rawData = await genericScraper.scrape(url);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    }
    
    return dataFormatter.format(rawData, url, platform, eventName);
  },

  async searchPlatform(platform, eventName, startDate, endDate) {
    logger.info(`Searching platform ${platform} for event ${eventName}`);
    
    switch (platform.toLowerCase()) {
      case 'reddit':
        return redditScraper.searchEvent(eventName, '3months');
      case 'twitter':
        return twitterScraper.searchEvent(eventName, startDate, endDate);
      case 'news':
        return newsScraper.searchEvent(eventName, startDate, endDate);
      case 'blogs':
        return blogScraper.searchEvent(eventName, startDate, endDate);
      default:
        throw new Error(`Platform ${platform} search not implemented`);
    }
  },

  async scrapeEvent(eventName, eventDate, platforms, socialLinks = null, output = 'json') {
    logger.info(`Scraping event: ${eventName} from date: ${eventDate}`);
    
    // Calculate the time range (3 months from event date)
    const startDate = new Date(eventDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 3);

    const scrapingTasks = [];

    // Add social media scraping tasks
    if (socialLinks) {
      for (const [platform, url] of Object.entries(socialLinks)) {
        scrapingTasks.push(this.scrapeSocialMedia(platform, url, startDate, endDate));
      }
    }

    // Validate platforms array
    if (!Array.isArray(platforms)) {
      throw new Error('Platforms must be an array');
    }

    // Add platform search tasks
    platforms.forEach(platform => {
      scrapingTasks.push(this.searchPlatform(platform, eventName, startDate, endDate));
    });

    const results = await Promise.allSettled(scrapingTasks);

    // Process results
    const successfulResults = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    const failedPlatforms = results
      .filter(result => result.status === 'rejected')
      .map(result => ({
        platform: result.reason.platform || 'unknown',
        error: result.reason.message
      }));

    const formattedData = {
      eventName,
      eventDate,
      scrapingPeriod: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      results: successfulResults,
      failedPlatforms,
      totalEngagement: this.calculateTotalEngagement(successfulResults),
      platforms: this.summarizePlatformResults(successfulResults),
      timestamp: new Date().toISOString()
    };

    // Return based on output format
    if (output.toLowerCase() === 'excel') {
      return await dataFormatter.convertToExcel(formattedData);
    }
    
    return formattedData;
  },

  async scrapeSocialMedia(platform, url, startDate, endDate) {
    try {
      let data;
      switch (platform.toLowerCase()) {
        case 'twitter':
          data = await twitterScraper.scrapeProfile(url, startDate, endDate);
          break;
        case 'instagram':
          data = await instagramScraper.scrapeProfile(url, startDate, endDate);
          break;
        case 'linkedin':
          data = await linkedinScraper.scrapeProfile(url, startDate, endDate);
          break;
        case 'reddit':
          data = await redditScraper.scrapeSubreddit(url, startDate, endDate);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      return dataFormatter.formatSocialData(data, platform, url);
    } catch (error) {
      logger.error(`Error scraping ${platform} URL ${url}: ${error.message}`);
      throw { platform, message: error.message };
    }
  },

  async searchPlatform(platform, eventName, startDate, endDate) {
    try {
      let data;
      switch (platform.toLowerCase()) {
        case 'reddit':
          data = await redditScraper.searchEvent(eventName, startDate, endDate);
          break;
        case 'twitter':
          data = await twitterScraper.searchEvent(eventName, startDate, endDate);
          break;
        case 'instagram':
          data = await instagramScraper.searchEvent(eventName, startDate, endDate);
          break;
        case 'linkedin':
          data = await linkedinScraper.searchEvent(eventName, startDate, endDate);
          break;
        case 'news':
          data = await newsScraper.searchEvent(eventName, startDate, endDate);
          break;
        case 'blogs':
          data = await blogScraper.searchEvent(eventName, startDate, endDate);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      return dataFormatter.formatEventData(data, platform, eventName);
    } catch (error) {
      logger.error(`Error searching ${platform} for event ${eventName}: ${error.message}`);
      throw { platform, message: error.message };
    }
  },

  async scrapeMultipleUrls(urls, eventName = '') {
    const results = await Promise.allSettled(
      urls.map(url => this.scrapeUrl(url, eventName))
    );
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Failed to scrape ${urls[index]}: ${result.reason.message}`);
        return {
          url: urls[index],
          error: result.reason.message,
          success: false
        };
      }
    });
  },

  async scrapeProfile(profileUrl, platform, eventName = '') {
    logger.info(`Scraping profile on ${platform}`);
    
    const rawData = await this.callPythonScraper(profileUrl, platform, eventName, true);
    
    return dataFormatter.formatProfile(rawData, profileUrl, platform, eventName);
  },

  async callPythonScraper(url, platform, eventName, isProfile = false) {
    try {
      const endpoint = isProfile ? '/scrape-profile' : '/scrape';
      const response = await axios.post(
        `${config.pythonApi.baseUrl}${endpoint}`,
        { url, platform, event_name: eventName },
        { timeout: config.pythonApi.timeout }
      );
      
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.error('Python scraper API is not running');
        throw new Error('Python scraper service unavailable. Please ensure it is running.');
      }
      throw error;
    }
  }
};

module.exports = scraperService;