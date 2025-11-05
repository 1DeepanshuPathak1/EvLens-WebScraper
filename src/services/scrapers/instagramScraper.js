const logger = require('../../utils/logger');

module.exports = {
  async searchEvent(eventName, startDate, endDate) {
    try {
      logger.info(`Searching Instagram for event: ${eventName}`);
      
      logger.warn('Instagram scraping requires Python service with Playwright for reliable results');
      
      return {
        platform: 'instagram',
        query: eventName,
        timeRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        posts: [],
        totalResults: 0,
        note: 'Instagram requires Python service. Use Python scraper API endpoint directly.'
      };
    } catch (error) {
      logger.error(`Instagram search error: ${error.message}`);
      return {
        platform: 'instagram',
        posts: [],
        totalResults: 0
      };
    }
  },

  async scrape(url) {
    logger.warn('Instagram scraping requires Python service with Playwright');
    return { 
      error: 'Instagram scraping requires Python service. Use Python API instead.' 
    };
  },

  async scrapeProfile(url, startDate, endDate) {
    logger.warn('Instagram profile scraping requires Python service with Playwright');
    return { 
      error: 'Instagram profile scraping requires Python service. Use Python API instead.' 
    };
  }
};