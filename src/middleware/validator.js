const validator = {
  validateScrapeRequest(req, res, next) {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
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