const axios = require('axios');
const platformDetector = require('./platformDetector');
const dataFormatter = require('./dataFormatter');
const relevanceFilter = require('./relevanceFilter');
const config = require('../config/scraperConfig');
const logger = require('../utils/logger');

const instagramScraper = require('./scrapers/instagramScraper');
const twitterScraper = require('./scrapers/twitterScraper');
const redditScraper = require('./scrapers/redditScraper');
const linkedinScraper = require('./scrapers/linkedinScraper');
const genericScraper = require('./scrapers/genericScraper');
const newsScraper = require('./scrapers/newsScraper');
const blogScraper = require('./scrapers/blogScraper');

const scraperService = {
  calculateTotalEngagement(results) {
    if (!Array.isArray(results)) return 0;
    
    return results.reduce((total, result) => {
      const posts = result.posts || [];
      return total + posts.reduce((postTotal, post) => {
        const engagement = post.engagement || {};
        return postTotal + (
          (engagement.likes || 0) + 
          ((engagement.comments || engagement.replies || 0) * 2) + 
          ((engagement.shares || engagement.retweets || 0) * 3)
        );
      }, 0);
    }, 0);
  },

  summarizePlatformResults(results) {
    if (!Array.isArray(results)) return {};
    
    return results.reduce((summary, result) => {
      const platform = result.platform;
      if (!summary[platform]) {
        summary[platform] = {
          totalPosts: 0,
          totalEngagement: 0,
          postTypes: {},
          sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 },
          topIssues: [],
          topPraise: [],
          avgRelevanceScore: 0
        };
      }

      const posts = result.posts || [];
      summary[platform].totalPosts += posts.length;
      
      let totalRelevance = 0;
      
      posts.forEach(post => {
        const engagement = post.engagement || {};
        summary[platform].totalEngagement += (
          (engagement.likes || 0) + 
          ((engagement.comments || engagement.replies || 0) * 2) + 
          ((engagement.shares || engagement.retweets || 0) * 3)
        );

        const type = post.type || 'unknown';
        summary[platform].postTypes[type] = (summary[platform].postTypes[type] || 0) + 1;
        
        if (post.sentiment) {
          summary[platform].sentimentBreakdown[post.sentiment] = 
            (summary[platform].sentimentBreakdown[post.sentiment] || 0) + 1;
        }
        
        if (post.insights) {
          post.insights.issues?.forEach(issue => {
            const existing = summary[platform].topIssues.find(i => i.issue === issue);
            if (existing) {
              existing.count++;
            } else {
              summary[platform].topIssues.push({ issue, count: 1 });
            }
          });
          
          post.insights.praise?.forEach(praise => {
            const existing = summary[platform].topPraise.find(p => p.praise === praise);
            if (existing) {
              existing.count++;
            } else {
              summary[platform].topPraise.push({ praise, count: 1 });
            }
          });
        }
        
        if (post.relevanceScore) {
          totalRelevance += post.relevanceScore;
        }
      });
      
      summary[platform].avgRelevanceScore = posts.length > 0 
        ? (totalRelevance / posts.length).toFixed(2) 
        : 0;
      
      summary[platform].topIssues.sort((a, b) => b.count - a.count);
      summary[platform].topPraise.sort((a, b) => b.count - a.count);

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

  async searchPlatform(platform, eventName, startDate, endDate, eventContext) {
    logger.info(`Searching platform ${platform} for event ${eventName}`);
    
    try {
      let data;
      
      switch (platform.toLowerCase()) {
        case 'reddit':
          data = await redditScraper.searchEvent(eventName, '3months', startDate);
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
        case 'generic':
          data = { posts: [], totalResults: 0, platform: 'generic' };
          break;
        default:
          throw new Error(`Platform ${platform} search not implemented`);
      }
      
      if (data && data.posts) {
        data.posts = relevanceFilter.filterRelevantPosts(
          data.posts, 
          eventName, 
          startDate, 
          eventContext,
          30
        );
        data.totalResults = data.posts.length;
        
        logger.info(`Filtered to ${data.posts.length} relevant posts for ${platform}`);
      }
      
      return data;
    } catch (error) {
      logger.error(`Error searching ${platform}: ${error.message}`);
      return { 
        posts: [], 
        totalResults: 0, 
        platform: platform,
        error: error.message 
      };
    }
  },

  async scrapeEvent(eventName, eventDate, platforms, socialLinks = null, output = 'json') {
    logger.info(`Scraping event: ${eventName} from date: ${eventDate}`);
    
    const startDate = new Date(eventDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 3);

    const eventContext = relevanceFilter.generateEventContext(eventName, eventDate);
    
    logger.info(`Generated event context with topics: ${eventContext.topics.join(', ')}`);

    const scrapingTasks = [];

    if (socialLinks && typeof socialLinks === 'object') {
      for (const [platform, url] of Object.entries(socialLinks)) {
        if (url) {
          scrapingTasks.push(
            this.scrapeSocialMedia(platform, url, startDate, endDate, eventContext)
              .catch(error => ({
                platform,
                posts: [],
                totalResults: 0,
                error: error.message
              }))
          );
        }
      }
    }

    if (!Array.isArray(platforms)) {
      throw new Error('Platforms must be an array');
    }

    platforms.forEach(platform => {
      scrapingTasks.push(
        this.searchPlatform(platform, eventName, startDate, endDate, eventContext)
          .then(data => dataFormatter.formatEventData(data, platform, eventName))
          .catch(error => ({
            platform,
            posts: [],
            totalResults: 0,
            error: error.message
          }))
      );
    });

    const results = await Promise.all(scrapingTasks);

    const successfulResults = results.filter(result => 
      result && Array.isArray(result.posts) && result.posts.length > 0
    );

    const failedPlatforms = results
      .filter(result => result && result.error)
      .map(result => ({
        platform: result.platform || 'unknown',
        error: result.error
      }));

    const platformSummary = this.summarizePlatformResults(successfulResults);
    
    const aggregatedInsights = this.aggregateInsights(successfulResults);

    const formattedData = {
      eventName,
      eventDate,
      eventContext,
      scrapingPeriod: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      results: successfulResults,
      failedPlatforms,
      totalEngagement: this.calculateTotalEngagement(successfulResults),
      platforms: platformSummary,
      insights: aggregatedInsights,
      timestamp: new Date().toISOString()
    };

    if (output.toLowerCase() === 'excel') {
      return await dataFormatter.convertToExcel(formattedData);
    }
    
    return formattedData;
  },

  aggregateInsights(results) {
    const allIssues = [];
    const allPraise = [];
    const sentiments = { positive: 0, negative: 0, neutral: 0 };
    
    results.forEach(result => {
      if (result.posts) {
        result.posts.forEach(post => {
          if (post.sentiment) {
            sentiments[post.sentiment] = (sentiments[post.sentiment] || 0) + 1;
          }
          
          if (post.insights) {
            allIssues.push(...(post.insights.issues || []));
            allPraise.push(...(post.insights.praise || []));
          }
        });
      }
    });
    
    const issueFrequency = {};
    allIssues.forEach(issue => {
      issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
    });
    
    const praiseFrequency = {};
    allPraise.forEach(praise => {
      praiseFrequency[praise] = (praiseFrequency[praise] || 0) + 1;
    });
    
    const topIssues = Object.entries(issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, mentions: count }));
    
    const topPraise = Object.entries(praiseFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([praise, count]) => ({ praise, mentions: count }));
    
    const total = sentiments.positive + sentiments.negative + sentiments.neutral;
    const sentimentPercentages = {
      positive: total > 0 ? ((sentiments.positive / total) * 100).toFixed(2) : 0,
      negative: total > 0 ? ((sentiments.negative / total) * 100).toFixed(2) : 0,
      neutral: total > 0 ? ((sentiments.neutral / total) * 100).toFixed(2) : 0
    };
    
    return {
      overallSentiment: sentimentPercentages,
      topIssues,
      topPraise,
      recommendations: this.generateRecommendations(topIssues, topPraise, sentimentPercentages)
    };
  },

  generateRecommendations(topIssues, topPraise, sentiment) {
    const recommendations = [];
    
    if (parseFloat(sentiment.negative) > 30) {
      recommendations.push({
        priority: 'high',
        category: 'overall',
        recommendation: 'Address negative sentiment - over 30% of feedback is negative'
      });
    }
    
    topIssues.slice(0, 3).forEach(({ issue, mentions }) => {
      recommendations.push({
        priority: 'high',
        category: 'issue',
        recommendation: `Fix: ${issue} (mentioned ${mentions} times)`
      });
    });
    
    topPraise.slice(0, 2).forEach(({ praise, mentions }) => {
      recommendations.push({
        priority: 'maintain',
        category: 'strength',
        recommendation: `Keep doing: ${praise} (mentioned ${mentions} times)`
      });
    });
    
    return recommendations;
  },

  async scrapeSocialMedia(platform, url, startDate, endDate, eventContext) {
    try {
      let data;
      switch (platform.toLowerCase()) {
        case 'twitter':
          data = await this.callPythonScraper(url, 'twitter', '', true);
          break;
        case 'instagram':
          data = await this.callPythonScraper(url, 'instagram', '', true);
          break;
        case 'linkedin':
          data = await this.callPythonScraper(url, 'linkedin', '', true);
          break;
        case 'reddit':
          const username = url.split('/').filter(Boolean).pop();
          data = await redditScraper.scrape(`https://www.reddit.com/user/${username}`);
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

  async scrapeMultipleUrls(urls, eventName = '') {
    if (!Array.isArray(urls)) {
      throw new Error('URLs must be an array');
    }
    
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
    
    let rawData;
    
    if (platform === 'reddit') {
      rawData = await redditScraper.scrape(profileUrl);
    } else {
      rawData = await this.callPythonScraper(profileUrl, platform, eventName, true);
    }
    
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