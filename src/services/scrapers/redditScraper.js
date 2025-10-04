const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config/scraperConfig');
const logger = require('../../utils/logger');

const redditScraper = {
  async scrape(url) {
    try {
      const jsonUrl = url.endsWith('.json') ? url : `${url}.json`;
      
      const response = await axios.get(jsonUrl, {
        headers: {
          'User-Agent': config.scraping.userAgent
        },
        timeout: config.scraping.timeout
      });

      const data = response.data;
      
      if (Array.isArray(data) && data.length > 0) {
        const post = data[0].data.children[0].data;
        const comments = data[1] ? data[1].data.children : [];

        return {
          post_text: post.title + (post.selftext ? '\n' + post.selftext : ''),
          author: post.author,
          subreddit: post.subreddit,
          likes: post.ups - post.downs,
          upvotes: post.ups,
          downvotes: post.downs,
          upvote_ratio: post.upvote_ratio,
          comments: this.parseComments(comments),
          timestamp: new Date(post.created_utc * 1000).toISOString(),
          awards: post.total_awards_received,
          post_type: post.post_hint || 'text'
        };
      }

      throw new Error('Invalid Reddit data structure');
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