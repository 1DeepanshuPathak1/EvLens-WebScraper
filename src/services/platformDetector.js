const config = require('../config/scraperConfig');

const platformDetector = {
  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    
    for (const [platform, { patterns }] of Object.entries(config.platforms)) {
      if (patterns.some(pattern => pattern.test(urlLower))) {
        return platform;
      }
    }
    
    return 'generic';
  },

  detectPostType(url) {
    const urlLower = url.toLowerCase();
    
    const typePatterns = {
      reel: /\/reel\//,
      video: /\/video\/|\/v\/|\/watch/,
      story: /\/stories\//,
      post: /\/p\/|\/posts?\/|\/status\/|\/comments\//,
      profile: /\/(u\/|user\/|@)/
    };
    
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(urlLower)) {
        return type;
      }
    }
    
    if (urlLower.match(/\/([\w\-\.]+)\/?$/)) {
      return 'profile';
    }
    
    return 'post';
  },

  isJavaScriptHeavy(platform) {
    return ['instagram', 'twitter', 'linkedin'].includes(platform);
  }
};

module.exports = platformDetector;