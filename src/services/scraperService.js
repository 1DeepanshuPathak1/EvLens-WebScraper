const axios = require('axios');
const platformDetector = require('./platformDetector');
const dataFormatter = require('./dataFormatter');
const config = require('../config/scraperConfig');
const logger = require('../utils/logger');

const instagramScraper = require('./scrapers/instagramScraper');
const twitterScraper = require('./scrapers/twitterScraper');
const redditScraper = require('./scrapers/redditScraper');
const linkedinScraper = require('./scrapers/linkedinScraper');
const genericScraper = require('./scrapers/genericScraper');

const scraperService = {
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