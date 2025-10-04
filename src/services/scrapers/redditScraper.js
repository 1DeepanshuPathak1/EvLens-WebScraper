const axios = require('axios');
const config = require('../../config/scraperConfig');
const logger = require('../../utils/logger');

const redditScraper = {
  async searchEvent(eventName, timeRange = '2months') {
    try {
      const allPosts = [];
      let after = null;
      let count = 0;
      
      // Keep fetching until we get all posts or hit limits
      while (count < 1000) { // Reasonable limit to prevent infinite loops
        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(eventName)}&sort=relevance&t=${timeRange}&type=link&raw_json=1&limit=100${after ? `&after=${after}` : ''}`;
        
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: config.scraping.timeout
        });

      if (!response.data || !response.data.data || !Array.isArray(response.data.data.children)) {
        break; // No more results available
      }

      const newPosts = response.data.data.children
        .map(child => child.data)
        .filter(post => post && post.title)
        .map(post => ({
          id: post.id,
          title: post.title,
          text: post.selftext,
          url: `https://reddit.com${post.permalink}`,
          subreddit: post.subreddit_name_prefixed,
          author: post.author,
          type: 'post',
          engagement: {
            likes: post.score,
            comments: post.num_comments,
            shares: post.num_crossposts || 0
          },
          postDate: new Date(post.created_utc * 1000).toISOString()
        }));

      allPosts.push(...newPosts);
      count += newPosts.length;

      // Get next page token
      after = response.data.data.after;
      if (!after) {
        logger.info(`No more Reddit posts to fetch. Total fetched: ${count}`);
        break;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      platform: 'reddit',
      query: eventName,
      timeRange,
      totalResults: allPosts.length,
      posts: allPosts
    };
    } catch (error) {
      logger.error(`Reddit search error: ${error.message}`);
      throw new Error(`Failed to search Reddit: ${error.message}`);
    }
  },

  async scrape(url) {
    try {
      // Extract post ID from URL
      const postId = url.match(/comments\/([a-zA-Z0-9]+)/)?.[1];
      if (!postId) {
        throw new Error('Invalid Reddit URL');
      }

      const response = await axios.get(`https://www.reddit.com/comments/${postId}.json`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: config.scraping.timeout
      });

      const [postData, commentsData] = response.data;
      const post = postData.data.children[0].data;

      return {
        id: post.id,
        title: post.title,
        text: post.selftext,
        url: url,
        subreddit: post.subreddit_name_prefixed,
        author: post.author || 'unknown',
        type: 'post',
        engagement: {
          likes: post.score,
          comments: post.num_comments,
          shares: post.num_crossposts || 0
        },
        postDate: new Date(post.created_utc * 1000).toISOString(),
        metadata: {
          upvoteRatio: post.upvote_ratio,
          awards: post.total_awards_received,
          isOriginalContent: post.is_original_content
        },
        comments: this.parseComments(commentsData.data.children)
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
            id: comment.id,
            text: comment.body,
            author: comment.author || '[deleted]',
            engagement: {
              likes: comment.score,
              replies: comment.replies ? comment.replies.data.children.length : 0
            },
            postDate: new Date(comment.created_utc * 1000).toISOString(),
            metadata: {
              awards: comment.total_awards_received || 0,
              isEdited: !!comment.edited
            }
          });

          // Recursively extract replies if they exist
          if (comment.replies?.data?.children) {
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