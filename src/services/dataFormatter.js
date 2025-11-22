const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const dataFormatter = {
  async convertToExcel(data) {
    try {
      const flattenedData = this.flattenDataForExcel(data);

      if (flattenedData.length === 0) {
        logger.warn('No data to export to Excel');

        // Check if this is an Instagram request - return demo data
        const hasInstagramPlatform = data.results && data.results.some(r => r.platform === 'instagram');
        if (hasInstagramPlatform) {
          const demoFilePath = path.join(process.cwd(), 'exports', 'demo_instagram_data.csv');
          if (fs.existsSync(demoFilePath)) {
            logger.info('Returning demo Instagram data');
            return {
              success: true,
              message: 'Demo Instagram data returned',
              filename: 'demo_instagram_data.csv',
              filepath: demoFilePath
            };
          }
        }

        return {
          success: false,
          message: 'No data available to generate Excel file',
          filename: null,
          filepath: null
        };
      }

      const fields = [
        'eventName',
        'eventDate',
        'platform',
        'postType',
        'postContent',
        'postUrl',
        'postAuthor',
        'postLikes',
        'postComments',
        'postShares',
        'postSentiment',
        'postDate',
        'postEngagement',
        'relevanceScore',
        'commentAuthor',
        'commentText',
        'commentLikes',
        'commentDate',
        'issues',
        'praise',
        'aspects'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(flattenedData);

      const filename = `event_analysis_${data.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      if (!fs.existsSync(path.join(process.cwd(), 'exports'))) {
        fs.mkdirSync(path.join(process.cwd(), 'exports'));
      }

      fs.writeFileSync(filepath, csv);

      return {
        success: true,
        message: 'Excel file generated successfully',
        filename,
        filepath,
        summary: {
          totalPosts: data.results.reduce((sum, r) => sum + (r.posts?.length || 0), 0),
          totalComments: flattenedData.filter(row => row.commentText).length,
          platforms: Object.keys(data.platforms || {}),
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

    if (!data.results || !Array.isArray(data.results)) {
      return flattened;
    }

    data.results.forEach(result => {
      if (result && Array.isArray(result.posts)) {
        result.posts.forEach(post => {
          if (post && typeof post === 'object') {
            const likes = this.parseNumber(post.likes || (post.engagement && post.engagement.likes) || 0);

            let commentsCount = 0;
            if (post.comment_count !== undefined) {
              commentsCount = post.comment_count;
            } else if (Array.isArray(post.comments)) {
              commentsCount = post.comments.length;
            } else if (post.engagement && (post.engagement.comments || post.engagement.replies)) {
              commentsCount = this.parseNumber(post.engagement.comments || post.engagement.replies);
            }

            const shares = this.parseNumber(post.shares || (post.engagement && post.engagement.shares) || (post.engagement && post.engagement.retweets) || 0);
            const engagementScore = post.video_views || (likes + (commentsCount * 2) + (shares * 3));

            const postData = {
              eventName: data.eventName || 'Unknown Event',
              eventDate: data.eventDate || new Date().toISOString().split('T')[0],
              platform: result.platform || 'unknown',
              postType: post.post_type || post.type || 'post',
              postContent: this.cleanText(post.post_text || post.text || post.title || ''),
              postUrl: post.url || '',
              postAuthor: post.author || (post.metadata && post.metadata.author) || 'Unknown',
              postLikes: likes,
              postComments: commentsCount,
              postShares: shares,
              postSentiment: post.sentiment || 'neutral',
              postDate: post.timestamp || post.created || post.postDate || post.created_at || new Date().toISOString(),
              postEngagement: engagementScore,
              relevanceScore: post.relevanceScore || post.engagement_rate || 0,
              issues: post.insights && post.insights.issues ? post.insights.issues.join('; ') : '',
              praise: post.insights && post.insights.praise ? post.insights.praise.join('; ') : '',
              aspects: post.insights && post.insights.aspects ? post.insights.aspects.join('; ') : ''
            };

            if (Array.isArray(post.comments) && post.comments.length > 0) {
              post.comments.forEach(comment => {
                flattened.push({
                  ...postData,
                  commentAuthor: comment.author || comment.user || 'Anonymous',
                  commentText: this.cleanText(comment.text || ''),
                  commentLikes: this.parseNumber(comment.likes || 0),
                  commentDate: comment.postDate || comment.timestamp || comment.created_at || ''
                });
              });
            } else {
              flattened.push({
                ...postData,
                commentAuthor: '',
                commentText: '',
                commentLikes: 0,
                commentDate: ''
              });
            }
          }
        });
      }
    });

    return flattened;
  },

  calculatePostEngagement(post) {
    if (!post) return 0;

    const likes = this.parseNumber(post.likes || (post.engagement && post.engagement.likes) || 0);

    let comments = 0;
    if (post.comment_count !== undefined) {
      comments = post.comment_count;
    } else if (Array.isArray(post.comments)) {
      comments = post.comments.length;
    } else if (post.engagement && (post.engagement.comments || post.engagement.replies)) {
      comments = this.parseNumber(post.engagement.comments || post.engagement.replies);
    }

    const shares = this.parseNumber(post.shares || (post.engagement && post.engagement.shares) || (post.engagement && post.engagement.retweets) || 0);

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
      total_results: rawData.totalResults || (rawData.posts && rawData.posts.length) || 0,
      time_range: rawData.timeRange || 'unknown',
      posts: (rawData.posts || []).map(post => ({
        id: post.id || '',
        url: post.url || '',
        title: this.cleanText(post.title || ''),
        text: this.cleanText(post.text || post.content || ''),
        author: post.author || 'Unknown',
        engagement: {
          likes: this.parseNumber(post.score || post.likes || (post.engagement && post.engagement.likes) || 0),
          comments: Array.isArray(post.comments) ? post.comments.length : (this.parseNumber(post.numComments || post.comments || (post.engagement && post.engagement.comments) || (post.engagement && post.engagement.replies) || 0)),
          shares: this.parseNumber(post.shares || (post.engagement && post.engagement.shares) || (post.engagement && post.engagement.retweets) || 0)
        },
        created_at: post.created || post.postDate || post.created_at || new Date().toISOString(),
        comments: this.formatComments(post.comments || []),
        sentiment: post.sentiment || 'neutral',
        relevanceScore: post.relevanceScore || 0,
        insights: post.insights || {},
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
    if (!Array.isArray(comments)) return [];

    return comments.map(comment => ({
      user: comment.user || comment.username || comment.author || 'Anonymous',
      text: this.cleanText(comment.text || comment.comment || comment.body || ''),
      likes: this.parseNumber(comment.likes || comment.reactions || comment.score || 0),
      timestamp: comment.timestamp || comment.created_at || comment.postDate || null,
      replies_count: this.parseNumber(comment.replies_count || comment.replies || 0),
      author: comment.author || comment.user || 'Anonymous',
      awards: comment.awards || 0
    }));
  },

  cleanText(text) {
    if (!text) return '';
    return String(text).trim().replace(/\s+/g, ' ');
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
    if (!text || typeof text !== 'string') return [];
    const hashtags = text.match(/#[\w]+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  },

  extractMentions(text) {
    if (!text || typeof text !== 'string') return [];
    const mentions = text.match(/@[\w]+/g) || [];
    return mentions.map(mention => mention.substring(1));
  },

  calculateEngagement(data) {
    const likes = this.parseNumber(data.likes || 0);
    const comments = Array.isArray(data.comments) ? data.comments.length : 0;
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
    if (!Array.isArray(comments)) return { positive: 0, negative: 0, neutral: 0, total: 0 };

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
    if (!Array.isArray(posts)) return { positive: 0, negative: 0, neutral: 0, total: 0, positive_percentage: 0, negative_percentage: 0 };

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
    if (total === 0) return { positive: 0, negative: 0, neutral: 0, total: 0, positive_percentage: 0, negative_percentage: 0 };

    return {
      positive: totalPositive,
      negative: totalNegative,
      neutral: totalNeutral,
      total,
      positive_percentage: ((totalPositive / total) * 100).toFixed(2),
      negative_percentage: ((totalNegative / total) * 100).toFixed(2)
    };
  },

  calculateProfileEngagement(posts) {
    if (!Array.isArray(posts) || posts.length === 0) return { average_likes: 0, average_comments: 0, average_engagement_rate: 0 };

    let totalLikes = 0;
    let totalComments = 0;
    let totalEngagementRate = 0;
    let postsWithEngagement = 0;

    posts.forEach(post => {
      const likes = this.parseNumber(post.likes || 0);
      const comments = Array.isArray(post.comments) ? post.comments.length : 0;
      totalLikes += likes;
      totalComments += comments;

      if (post.engagement && post.engagement.engagement_rate) {
        totalEngagementRate += parseFloat(post.engagement.engagement_rate);
        postsWithEngagement++;
      }
    });

    return {
      average_likes: Math.round(totalLikes / posts.length),
      average_comments: Math.round(totalComments / posts.length),
      average_engagement_rate: postsWithEngagement > 0 ? (totalEngagementRate / postsWithEngagement).toFixed(2) : 0
    };
  },

  formatSocialData(rawData, platform, url) {
    return this.formatProfile(rawData, url, platform, 'Unknown Event');
  }
};

module.exports = dataFormatter;