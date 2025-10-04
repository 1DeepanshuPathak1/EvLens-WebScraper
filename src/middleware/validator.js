const logger = require('../utils/logger');

const validator = {
  validateScrapeRequest(req, res, next) {
    const { url, eventName } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    if (!eventName) {
      return res.status(400).json({
        success: false,
        error: 'Event name is required'
      });
    }

    if (!validator.isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    next();
  },

  validateMultipleScrapeRequest(req, res, next) {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    if (urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one URL is required'
      });
    }

    if (urls.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 URLs allowed per request'
      });
    }

    const invalidUrls = urls.filter(url => !validator.isValidUrl(url));
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid URLs: ${invalidUrls.join(', ')}`
      });
    }

    next();
  },

  validateProfileScrapeRequest(req, res, next) {
    const { profileUrl, platform } = req.body;
    
    if (!profileUrl) {
      return res.status(400).json({
        success: false,
        error: 'Profile URL is required'
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    if (!validator.isValidUrl(profileUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile URL format'
      });
    }

    const supportedPlatforms = ['instagram', 'twitter', 'linkedin', 'reddit'];
    if (!supportedPlatforms.includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Unsupported platform. Supported: ${supportedPlatforms.join(', ')}`
      });
    }

    next();
  },

  validateEventScrapeRequest(req, res, next) {
    const { eventName, eventDate, platforms, socialLinks, output } = req.body;
    
    if (!eventName) {
      return res.status(400).json({
        success: false,
        error: 'Event name is required'
      });
    }

    if (!eventDate) {
      return res.status(400).json({
        success: false,
        error: 'Event date is required (YYYY-MM-DD format)'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(eventDate) || isNaN(new Date(eventDate).getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event date format. Use YYYY-MM-DD'
      });
    }

    if (platforms && !Array.isArray(platforms)) {
      return res.status(400).json({
        success: false,
        error: 'Platforms must be an array if provided'
      });
    }

    if (socialLinks && typeof socialLinks !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Social links must be an object if provided'
      });
    }

    const supportedPlatforms = ['instagram', 'twitter', 'linkedin', 'reddit', 'news', 'blogs'];
    
    if (platforms && platforms.length > 0) {
      const unsupportedPlatforms = platforms.filter(p => !supportedPlatforms.includes(p.toLowerCase()));
      if (unsupportedPlatforms.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Unsupported platforms: ${unsupportedPlatforms.join(', ')}. Supported: ${supportedPlatforms.join(', ')}`
        });
      }
    }

    if (output && !['json', 'excel'].includes(output.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Output format must be either "json" or "excel"'
      });
    }

    // If no platforms specified, use all available platforms
    if (!platforms || platforms.length === 0) {
      const availablePlatforms = ['reddit', 'twitter', 'instagram', 'linkedin', 'news', 'blogs', 'generic'];
      req.body.platforms = availablePlatforms;
      try {
        logger.info(`No platforms specified. Using all available platforms: ${availablePlatforms.join(', ')}`);
      } catch (error) {
        console.log(`No platforms specified. Using all available platforms: ${availablePlatforms.join(', ')}`);
      }
    }

    // Default output format to json
    if (!output) {
      req.body.output = 'json';
      try {
        logger.info('No output format specified. Using default: json');
      } catch (error) {
        console.log('No output format specified. Using default: json');
      }
    }

    next();
  },

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }
};

module.exports = validator;