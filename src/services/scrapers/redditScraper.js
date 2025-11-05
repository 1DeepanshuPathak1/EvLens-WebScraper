const axios = require('axios');
const config = require('../../config/scraperConfig');
const logger = require('../../utils/logger');

const redditScraper = {
  async searchEvent(eventName, timeRange = '3months', eventDate = null) {
    try {
      const allPosts = [];
      
      const eventKeywords = this.extractEventKeywords(eventName);
      const searchQueries = this.buildSearchQueries(eventName, eventKeywords);
      
      for (const query of searchQueries) {
        logger.info(`Searching Reddit with query: ${query}`);
        
        let queryAfter = null;
        let queryCount = 0;
        
        while (queryCount < 200) {
          const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=${timeRange}&type=link&raw_json=1&limit=100${queryAfter ? `&after=${queryAfter}` : ''}`;
          
          const response = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: config.scraping.timeout
          });

          if (!response.data || !response.data.data || !Array.isArray(response.data.data.children)) {
            break;
          }

          const newPosts = response.data.data.children
            .map(child => child.data)
            .filter(post => post && post.title && this.isRelevantPost(post, eventName, eventKeywords, eventDate))
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
              postDate: new Date(post.created_utc * 1000).toISOString(),
              relevanceIndicators: this.getRelevanceIndicators(post, eventName, eventKeywords),
              needsComments: true,
              permalink: post.permalink
            }));

          allPosts.push(...newPosts);
          queryCount += newPosts.length;

          queryAfter = response.data.data.after;
          if (!queryAfter) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const uniquePosts = this.removeDuplicates(allPosts);
      const sortedPosts = this.sortByRelevance(uniquePosts, eventName);

      logger.info(`Found ${sortedPosts.length} relevant Reddit posts, now fetching comments...`);

      const postsWithComments = [];
      for (const post of sortedPosts.slice(0, 100)) {
        try {
          const fullPost = await this.scrape(`https://reddit.com${post.permalink}`);
          if (fullPost && !fullPost.error) {
            postsWithComments.push({
              ...post,
              comments: fullPost.comments || [],
              fullText: fullPost.text || post.text
            });
          } else {
            postsWithComments.push(post);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Error fetching comments for ${post.url}: ${error.message}`);
          postsWithComments.push(post);
        }
      }

      logger.info(`Successfully fetched comments for ${postsWithComments.length} posts`);

      return {
        platform: 'reddit',
        query: eventName,
        timeRange,
        totalResults: postsWithComments.length,
        posts: postsWithComments
      };
    } catch (error) {
      logger.error(`Reddit search error: ${error.message}`);
      throw new Error(`Failed to search Reddit: ${error.message}`);
    }
  },

  extractEventKeywords(eventName) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'event', 'summit', 'conference', 'festival'
    ]);

    return eventName
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  },

  buildSearchQueries(eventName, keywords) {
    const queries = [
      eventName,
      `"${eventName}"`,
      keywords.join(' AND '),
      keywords.slice(0, 3).join(' '),
    ];

    if (keywords.length > 1) {
      queries.push(`${keywords[0]} ${keywords[1]}`);
    }

    return [...new Set(queries)];
  },

  isRelevantPost(post, eventName, eventKeywords, eventDate) {
    const titleLower = (post.title || '').toLowerCase();
    const textLower = (post.selftext || '').toLowerCase();
    const combined = `${titleLower} ${textLower}`;
    
    const exactMatch = combined.includes(eventName.toLowerCase());
    if (exactMatch) return true;
    
    const matchedKeywords = eventKeywords.filter(keyword => 
      combined.includes(keyword)
    );
    const keywordMatchRatio = matchedKeywords.length / eventKeywords.length;
    
    if (keywordMatchRatio >= 0.5) return true;
    
    if (eventDate) {
      const postDate = new Date(post.created_utc * 1000);
      const eventDateObj = new Date(eventDate);
      const daysDiff = Math.abs((postDate - eventDateObj) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 90 && keywordMatchRatio >= 0.3) return true;
    }
    
    const engagementThreshold = post.score > 50 || post.num_comments > 10;
    if (engagementThreshold && keywordMatchRatio >= 0.3) return true;
    
    return false;
  },

  getRelevanceIndicators(post, eventName, eventKeywords) {
    const indicators = [];
    const titleLower = (post.title || '').toLowerCase();
    const textLower = (post.selftext || '').toLowerCase();
    
    if (titleLower.includes(eventName.toLowerCase())) {
      indicators.push('exact_title_match');
    }
    
    if (textLower.includes(eventName.toLowerCase())) {
      indicators.push('exact_text_match');
    }
    
    const matchedKeywords = eventKeywords.filter(keyword => 
      titleLower.includes(keyword) || textLower.includes(keyword)
    );
    indicators.push(`${matchedKeywords.length}_keywords_matched`);
    
    if (post.score > 100) {
      indicators.push('high_engagement');
    }
    
    return indicators;
  },

  removeDuplicates(posts) {
    const seen = new Set();
    return posts.filter(post => {
      if (seen.has(post.id)) {
        return false;
      }
      seen.add(post.id);
      return true;
    });
  },

  sortByRelevance(posts, eventName) {
    return posts.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, eventName);
      const scoreB = this.calculateRelevanceScore(b, eventName);
      return scoreB - scoreA;
    });
  },

  calculateRelevanceScore(post, eventName) {
    let score = 0;
    
    const titleLower = (post.title || '').toLowerCase();
    const textLower = (post.text || '').toLowerCase();
    
    if (titleLower.includes(eventName.toLowerCase())) {
      score += 50;
    }
    
    if (textLower.includes(eventName.toLowerCase())) {
      score += 30;
    }
    
    score += Math.log(post.engagement.likes + 1) * 5;
    score += Math.log(post.engagement.comments + 1) * 3;
    
    score += (post.relevanceIndicators || []).length * 5;
    
    return score;
  },

  async scrape(url) {
    try {
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

      const allComments = this.parseComments(commentsData.data.children);

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
          comments: allComments.length,
          shares: post.num_crossposts || 0
        },
        postDate: new Date(post.created_utc * 1000).toISOString(),
        metadata: {
          upvoteRatio: post.upvote_ratio,
          awards: post.total_awards_received,
          isOriginalContent: post.is_original_content
        },
        comments: allComments
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
        if (item.kind === 't1' && item.data && item.data.body) {
          const comment = item.data;
          comments.push({
            id: comment.id,
            text: comment.body,
            author: comment.author || '[deleted]',
            likes: comment.score,
            postDate: new Date(comment.created_utc * 1000).toISOString(),
            awards: comment.total_awards_received || 0,
            isEdited: !!comment.edited
          });

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