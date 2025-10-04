const helpers = {
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.href;
    } catch (error) {
      return null;
    }
  },

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return null;
    }
  },

  truncateText(text, maxLength = 500) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  retryOperation(operation, retries = 3, delayMs = 2000) {
    return new Promise((resolve, reject) => {
      const attempt = async (n) => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          if (n === 0) {
            reject(error);
          } else {
            await helpers.delay(delayMs);
            attempt(n - 1);
          }
        }
      };
      attempt(retries);
    });
  },

  parseDate(dateString) {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
};

module.exports = helpers;