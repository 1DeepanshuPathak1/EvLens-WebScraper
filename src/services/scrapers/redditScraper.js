const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config/scraperConfig');
const logger = require('../../utils/logger');

const redditScraper = {
  async scrape(url) {
    try {
      let jsonUrl = url.endsWith('.json') ? url : `${url}.json`;
      
      if (!jsonUrl.includes('?')) {
        jsonUrl += '?raw_json=1';
      } else {
        jsonUrl += '&raw_json=1';
      }
      
      const response = await axios.get(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: config.scraping.timeout,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      if (response.status === 404) {
        throw new Error('Reddit post not found or has been deleted');
      }

      if (response.status === 403) {
        throw new Error('Reddit blocked the request. Try again later or use a different post.');
      }

      const data = response.data;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        logger.error('Invalid Reddit response structure');
        throw new Error('Invalid Reddit data structure');
      }

      const postData = data[0]?.data?.children?.[0]?.data;
      if (!postData) {
        logger.error('No post data found in Reddit response');
        throw new Error('Reddit post not found or has been deleted');
      }

      const commentsData = data[1]?.data?.children || [];

      return {
        post_text: postData.title + (postData.selftext ? '\n' + postData.selftext : ''),
        author: postData.author || 'unknown',
        subreddit: postData.subreddit || 'unknown',
        likes: (postData.ups || 0) - (postData.downs || 0),
        upvotes: postData.ups || 0,
        downvotes: postData.downs || 0,
        upvote_ratio: postData.upvote_ratio || 0,
        comments: this.parseComments(commentsData),
        timestamp: new Date((postData.created_utc || 0) * 1000).toISOString(),
        awards: postData.total_awards_received || 0,
        post_type: postData.post_hint || 'text'
      };
    } catch (error) {
      logger.error(`Reddit scraping error: ${error.message}`);
      
      if (error.response?.status === 404) {
        throw new Error('Reddit post not found');
      }
      
      return { error: error.message };
    }
  },

  parseComments(commentsData) {
    const comments = [];
    
    const extractComments = (items) => {
      items.forEach(item => {
        if (item.kind === 't1' && item.data) {
          const comment = item.data;
          comments.push({
            user: comment.author,
            text: comment.body,
            likes: comment.ups - comment.downs,
            timestamp: new Date(comment.created_utc * 1000).toISOString(),
            replies_count: comment.replies ? comment.replies.data.children.length : 0,
            awards: comment.total_awards_received
          });

          if (comment.replies && comment.replies.data && comment.replies.data.children) {
            extractComments(comment.replies.data.children);
          }
        }
      });
    };

    extractComments(commentsData);
    return comments;
  }
};

module.exports = redditScraper;