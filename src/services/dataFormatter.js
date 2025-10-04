const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const dataFormatter = {
  async convertToExcel(data) {
    try {
      // Flatten the data structure for CSV
      const flattenedData = this.flattenDataForExcel(data);
      
      // Define fields for CSV
      const fields = [
        'eventName',
        'eventDate',
        'platform',
        'postType',
        'content',
        'url',
        'author',
        'likes',
        'comments',
        'shares',
        'sentiment',
        'postDate',
        'engagement'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(flattenedData);

      // Generate unique filename
      const filename = `event_analysis_${data.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      // Ensure exports directory exists
      if (!fs.existsSync(path.join(process.cwd(), 'exports'))) {
        fs.mkdirSync(path.join(process.cwd(), 'exports'));
      }

      // Write CSV file
      fs.writeFileSync(filepath, csv);

      return {
        success: true,
        message: 'Excel file generated successfully',
        filename,
        filepath,
        summary: {
          totalPosts: flattenedData.length,
          platforms: data.platforms,
          periodCovered: data.scrapingPeriod,
          totalEngagement: data.totalEngagement
        }
      };
    } catch (error) {
      logger.error(`Error generating Excel file: ${error.message}`);
      throw new Error(`Failed to generate Excel file: ${error.message}`);
    }
  },

  flattenDataForExcel(data) {
    const flattened = [];
    
    data.results.forEach(result => {
      if (Array.isArray(result.posts)) {
        result.posts.forEach(post => {
          flattened.push({
            eventName: data.eventName,
            eventDate: data.eventDate,
            platform: result.platform,
            postType: post.type || 'post',
            content: post.text || post.title || '',
            url: post.url,
            author: post.metadata?.author || 'Unknown',
            likes: post.engagement?.likes || 0,
            comments: post.engagement?.comments || 0,
            shares: post.engagement?.shares || 0,
            sentiment: post.sentiment || 'neutral',
            postDate: post.created_at,
            engagement: this.calculatePostEngagement(post)
          });
        });
      }
    });

    return flattened;
  },

  calculatePostEngagement(post) {
    const likes = post.engagement?.likes || 0;
    const comments = post.engagement?.comments || 0;
    const shares = post.engagement?.shares || 0;
    return likes + (comments * 2) + (shares * 3);
  },

  format(rawData, url, platform, eventName) {
    const baseFormat = {
      url,
      platform,
      event_name: eventName || 'Unknown Event',
      scraped_at: new Date().toISOString()
    };

    if (rawData.error) {
      return {
        ...baseFormat,
        success: false,
        error: rawData.error
      };
    }

    return {
      ...baseFormat,
      success: true,
      post_text: this.cleanText(rawData.post_text || rawData.text || ''),
      comments: this.formatComments(rawData.comments || []),
      likes: this.parseNumber(rawData.likes || rawData.reactions || 0),
      shares: this.parseNumber(rawData.shares || rawData.retweets || 0),
      timestamp: rawData.timestamp || rawData.created_at || new Date().toISOString(),
      engagement: this.calculateEngagement(rawData),
      sentiment_data: this.extractSentimentData(rawData.comments || []),
      metadata: {
        author: rawData.author || rawData.username || 'Unknown',
        post_type: rawData.post_type || 'post',
        hashtags: this.extractHashtags(rawData.post_text || ''),
        mentions: this.extractMentions(rawData.post_text || '')
      }
    };
  },

  formatEventData(rawData, platform, eventName) {
    if (!rawData || rawData.error) {
      return {
        success: false,
        error: rawData.error || 'No data available',
        platform,
        event_name: eventName,
        scraped_at: new Date().toISOString()
      };
    }

    return {
      success: true,
      platform,
      event_name: eventName,
      scraped_at: new Date().toISOString(),
      total_results: rawData.totalResults || rawData.posts?.length || 0,
      time_range: rawData.timeRange || 'unknown',
      posts: (rawData.posts || []).map(post => ({
        id: post.id || '',
        url: post.url || '',
        title: this.cleanText(post.title || ''),
        text: this.cleanText(post.text || ''),
        engagement: {
          likes: this.parseNumber(post.score || post.likes || 0),
          comments: this.parseNumber(post.numComments || post.comments || 0),
          shares: this.parseNumber(post.shares || 0)
        },
        created_at: post.created || new Date().toISOString(),
        metadata: {
          subreddit: post.subreddit || '',
          author: post.author || 'Unknown',
          hashtags: this.extractHashtags(post.text || post.title || ''),
          mentions: this.extractMentions(post.text || post.title || '')
        }
      }))
    };
  },

  formatProfile(rawData, profileUrl, platform, eventName) {
    return {
      profile_url: profileUrl,
      platform,
      event_name: eventName || 'Unknown Event',
      scraped_at: new Date().toISOString(),
      success: !rawData.error,
      profile_data: {
        username: rawData.username || 'Unknown',
        followers: this.parseNumber(rawData.followers || 0),
        following: this.parseNumber(rawData.following || 0),
        posts_count: this.parseNumber(rawData.posts_count || 0)
      },
      posts: (rawData.posts || []).map(post => this.format(post, post.url || profileUrl, platform, eventName)),
      overall_sentiment: this.calculateOverallSentiment(rawData.posts || []),
      engagement_metrics: this.calculateProfileEngagement(rawData.posts || [])
    };
  },

  formatComments(comments) {
    return comments.map(comment => ({
      user: comment.user || comment.username || comment.author || 'Anonymous',
      text: this.cleanText(comment.text || comment.comment || ''),
      likes: this.parseNumber(comment.likes || comment.reactions || 0),
      timestamp: comment.timestamp || comment.created_at || null,
      replies_count: this.parseNumber(comment.replies_count || comment.replies || 0)
    }));
  },

  cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').replace(/[\r\n]+/g, ' ');
  },

  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.KMB]/gi, '');
      const multipliers = { K: 1000, M: 1000000, B: 1000000000 };
      const match = cleaned.match(/(\d+\.?\d*)([KMB])?/i);
      if (match) {
        const num = parseFloat(match[1]);
        const mult = match[2] ? multipliers[match[2].toUpperCase()] : 1;
        return Math.floor(num * mult);
      }
    }
    return 0;
  },

  extractHashtags(text) {
    const hashtags = text.match(/#[\w]+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  },

  extractMentions(text) {
    const mentions = text.match(/@[\w]+/g) || [];
    return mentions.map(mention => mention.substring(1));
  },

  calculateEngagement(data) {
    const likes = this.parseNumber(data.likes || 0);
    const comments = (data.comments || []).length;
    const shares = this.parseNumber(data.shares || 0);
    return {
      total_interactions: likes + comments + shares,
      likes,
      comments,
      shares,
      engagement_rate: this.calculateEngagementRate(likes, comments, shares, data.followers)
    };
  },

  calculateEngagementRate(likes, comments, shares, followers) {
    if (!followers || followers === 0) return null;
    const totalEngagement = likes + comments + shares;
    return ((totalEngagement / followers) * 100).toFixed(2);
  },

  extractSentimentData(comments) {
    const sentimentKeywords = {
      positive: ['amazing', 'great', 'awesome', 'best', 'love', 'excellent', 'fantastic', 'wonderful', 'perfect', 'good'],
      negative: ['bad', 'worst', 'terrible', 'awful', 'hate', 'poor', 'disappointing', 'waste', 'not worth', 'crowded']
    };

    let positive = 0;
    let negative = 0;
    let neutral = 0;

    comments.forEach(comment => {
      const text = (comment.text || '').toLowerCase();
      const hasPositive = sentimentKeywords.positive.some(word => text.includes(word));
      const hasNegative = sentimentKeywords.negative.some(word => text.includes(word));

      if (hasPositive && !hasNegative) positive++;
      else if (hasNegative && !hasPositive) negative++;
      else neutral++;
    });

    return { positive, negative, neutral, total: comments.length };
  },

  calculateOverallSentiment(posts) {
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;

    posts.forEach(post => {
      const sentiment = this.extractSentimentData(post.comments || []);
      totalPositive += sentiment.positive;
      totalNegative += sentiment.negative;
      totalNeutral += sentiment.neutral;
    });

    const total = totalPositive + totalNegative + totalNeutral;
    return {
      positive: totalPositive,
      negative: totalNegative,
      neutral: totalNeutral,
      total,
      positive_percentage: total > 0 ? ((totalPositive / total) * 100).toFixed(2) : 0,
      negative_percentage: total > 0 ? ((totalNegative / total) * 100).toFixed(2) : 0
    };
  },

  calculateProfileEngagement(posts) {
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    posts.forEach(post => {
      totalLikes += this.parseNumber(post.likes || 0);
      totalComments += (post.comments || []).length;
      totalShares += this.parseNumber(post.shares || 0);
    });

    return {
      total_posts: posts.length,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      avg_likes_per_post: posts.length > 0 ? (totalLikes / posts.length).toFixed(2) : 0,
      avg_comments_per_post: posts.length > 0 ? (totalComments / posts.length).toFixed(2) : 0
    };
  }
};

module.exports = dataFormatter;