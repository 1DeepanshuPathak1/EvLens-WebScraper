const logger = require('../utils/logger');

const relevanceFilter = {
  calculateRelevanceScore(text, eventName, eventDate, eventContext = {}) {
    if (!text || typeof text !== 'string') return 0;
    
    const textLower = text.toLowerCase();
    const eventNameLower = eventName.toLowerCase();
    
    let score = 0;
    
    const eventWords = this.extractKeywords(eventNameLower);
    const textWords = this.extractKeywords(textLower);
    
    const matchedKeywords = eventWords.filter(keyword => 
      textWords.includes(keyword) || textLower.includes(keyword)
    );
    
    score += (matchedKeywords.length / eventWords.length) * 40;
    
    if (textLower.includes(eventNameLower)) {
      score += 30;
    }
    
    const eventYear = new Date(eventDate).getFullYear();
    const eventMonth = new Date(eventDate).toLocaleString('en', { month: 'long' }).toLowerCase();
    
    if (textLower.includes(eventYear.toString())) {
      score += 10;
    }
    
    if (textLower.includes(eventMonth)) {
      score += 5;
    }
    
    const contextKeywords = [
      ...(eventContext.topics || []),
      ...(eventContext.speakers || []),
      ...(eventContext.location || []),
      ...(eventContext.hashtags || [])
    ].map(k => k.toLowerCase());
    
    contextKeywords.forEach(keyword => {
      if (textLower.includes(keyword)) {
        score += 3;
      }
    });
    
    const experienceKeywords = [
      'attended', 'went to', 'was at', 'participated', 'joined',
      'experience at', 'my experience', 'at the event', 'during the event',
      'event was', 'conference was', 'summit was'
    ];
    
    experienceKeywords.forEach(keyword => {
      if (textLower.includes(keyword)) {
        score += 5;
      }
    });
    
    return Math.min(score, 100);
  },

  extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where',
      'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'now', 'then'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  },

  analyzeSentiment(text) {
    if (!text || typeof text !== 'string') return 'neutral';
    
    const textLower = text.toLowerCase();
    
    const positiveWords = [
      'amazing', 'excellent', 'great', 'awesome', 'fantastic', 'wonderful',
      'outstanding', 'brilliant', 'superb', 'incredible', 'perfect', 'love',
      'loved', 'best', 'enjoyed', 'inspiring', 'insightful', 'valuable',
      'impressive', 'remarkable', 'successful', 'well organized', 'smooth',
      'professional', 'engaging', 'informative', 'helpful', 'worth it'
    ];
    
    const negativeWords = [
      'terrible', 'awful', 'bad', 'worst', 'horrible', 'disappointing',
      'poor', 'useless', 'waste', 'not worth', 'failed', 'disaster',
      'chaotic', 'disorganized', 'unprofessional', 'boring', 'dull',
      'crowded', 'overpriced', 'underwhelming', 'frustrating', 'confusing',
      'lacking', 'insufficient', 'inadequate', 'subpar'
    ];
    
    const positiveCount = positiveWords.filter(word => textLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => textLower.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  },

  extractInsights(text) {
    if (!text || typeof text !== 'string') return {};
    
    const textLower = text.toLowerCase();
    const insights = {
      aspects: [],
      issues: [],
      praise: [],
      suggestions: []
    };
    
    const aspectPatterns = {
      'venue': ['venue', 'location', 'place', 'facility', 'hall', 'auditorium'],
      'food': ['food', 'catering', 'lunch', 'dinner', 'breakfast', 'snacks', 'refreshments'],
      'organization': ['organization', 'organized', 'schedule', 'timing', 'coordination', 'management'],
      'content': ['content', 'sessions', 'talks', 'presentations', 'speakers', 'topics'],
      'networking': ['networking', 'connections', 'meet', 'people', 'attendees', 'community'],
      'registration': ['registration', 'check-in', 'tickets', 'badges', 'entry'],
      'technology': ['wifi', 'internet', 'audio', 'video', 'tech', 'equipment', 'av']
    };
    
    for (const [aspect, keywords] of Object.entries(aspectPatterns)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        insights.aspects.push(aspect);
      }
    }
    
    const issuePatterns = [
      { pattern: /long (wait|queue|line)/, issue: 'Long waiting times' },
      { pattern: /(crowded|packed|too many people)/, issue: 'Overcrowding' },
      { pattern: /(no|poor|bad) (wifi|internet)/, issue: 'Poor internet connectivity' },
      { pattern: /(cold|hot) (food|meal)/, issue: 'Food temperature issues' },
      { pattern: /(running|ran) late/, issue: 'Schedule delays' },
      { pattern: /(unclear|confusing) (signage|directions)/, issue: 'Poor signage' },
      { pattern: /(limited|no|insufficient) (parking|seating)/, issue: 'Limited capacity' }
    ];
    
    issuePatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(textLower)) {
        insights.issues.push(issue);
      }
    });
    
    const praisePatterns = [
      { pattern: /(great|amazing|excellent) (venue|location)/, praise: 'Excellent venue' },
      { pattern: /(delicious|great|amazing) (food|catering)/, praise: 'Great food' },
      { pattern: /(well|perfectly) organized/, praise: 'Well organized' },
      { pattern: /(informative|insightful|valuable) (session|talk|content)/, praise: 'Valuable content' },
      { pattern: /(great|good|excellent) (networking|connections)/, praise: 'Good networking opportunities' }
    ];
    
    praisePatterns.forEach(({ pattern, praise }) => {
      if (pattern.test(textLower)) {
        insights.praise.push(praise);
      }
    });
    
    const suggestionPatterns = [
      { pattern: /should (have|add|include|provide)/, type: 'suggestion' },
      { pattern: /would be (better|nice|good) (if|to)/, type: 'suggestion' },
      { pattern: /(need|needs) (more|better)/, type: 'suggestion' }
    ];
    
    if (suggestionPatterns.some(({ pattern }) => pattern.test(textLower))) {
      insights.suggestions.push(text.substring(0, 200));
    }
    
    return insights;
  },

  filterRelevantPosts(posts, eventName, eventDate, eventContext = {}, minScore = 30) {
    if (!Array.isArray(posts)) return [];
    
    return posts
      .map(post => {
        const text = [
          post.title || '',
          post.text || '',
          post.content || '',
          ...(post.comments || []).map(c => c.text || '')
        ].join(' ');
        
        const relevanceScore = this.calculateRelevanceScore(text, eventName, eventDate, eventContext);
        const sentiment = this.analyzeSentiment(text);
        const insights = this.extractInsights(text);
        
        return {
          ...post,
          relevanceScore,
          sentiment,
          insights,
          isRelevant: relevanceScore >= minScore
        };
      })
      .filter(post => post.isRelevant)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  },

  generateEventContext(eventName, eventDate) {
    const context = {
      topics: [],
      hashtags: [],
      location: [],
      speakers: []
    };
    
    const eventLower = eventName.toLowerCase();
    
    const topicMap = {
      'climate': ['climate change', 'global warming', 'sustainability', 'carbon', 'emissions', 'renewable'],
      'tech': ['technology', 'ai', 'artificial intelligence', 'machine learning', 'innovation', 'digital'],
      'music': ['concert', 'performance', 'artist', 'stage', 'live music', 'festival'],
      'sports': ['game', 'match', 'tournament', 'championship', 'competition', 'athlete'],
      'business': ['startup', 'entrepreneur', 'investor', 'funding', 'business model', 'strategy'],
      'health': ['healthcare', 'medical', 'wellness', 'fitness', 'nutrition', 'mental health']
    };
    
    for (const [category, keywords] of Object.entries(topicMap)) {
      if (keywords.some(keyword => eventLower.includes(keyword)) || eventLower.includes(category)) {
        context.topics.push(...keywords);
      }
    }
    
    const words = eventName.split(' ');
    context.hashtags = words
      .filter(word => word.length > 3)
      .map(word => `#${word.toLowerCase()}`);
    
    return context;
  }
};

module.exports = relevanceFilter;