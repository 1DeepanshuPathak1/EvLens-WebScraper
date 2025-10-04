const scraperService = require('../services/scraperService');
const logger = require('../utils/logger');

const scraperController = {
  async scrapeUrl(req, res, next) {
    try {
      const { url, eventName } = req.body;
      logger.info(`Scraping URL: ${url}`);
      
      const result = await scraperService.scrapeUrl(url, eventName);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error scraping URL: ${error.message}`);
      next(error);
    }
  },

  async scrapeMultipleUrls(req, res, next) {
    try {
      const { urls, eventName } = req.body;
      logger.info(`Scraping multiple URLs: ${urls.length} URLs`);
      
      const results = await scraperService.scrapeMultipleUrls(urls, eventName);
      
      res.json({
        success: true,
        data: results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error scraping multiple URLs: ${error.message}`);
      next(error);
    }
  },

  async scrapeProfile(req, res, next) {
    try {
      const { profileUrl, platform, eventName } = req.body;
      logger.info(`Scraping profile: ${profileUrl} on ${platform}`);
      
      const result = await scraperService.scrapeProfile(profileUrl, platform, eventName);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error scraping profile: ${error.message}`);
      next(error);
    }
  },

  getSupportedPlatforms(req, res) {
    const platforms = ['instagram', 'twitter', 'reddit', 'linkedin', 'generic'];
    res.json({
      success: true,
      platforms,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = scraperController;