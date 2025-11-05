const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');
const config = require('../../config/scraperConfig');

const blogScraper = {
    async searchEvent(eventName, startDate, endDate) {
        try {
            logger.info(`Searching blogs for event: ${eventName} between ${startDate} and ${endDate}`);
            
            const searchQuery = encodeURIComponent(`${eventName} blog`);
            const posts = [];
            
            const searchEngines = [
                `https://www.google.com/search?q=${searchQuery}&tbm=nws&num=100`,
                `https://duckduckgo.com/?q=${searchQuery}&ia=web`
            ];

            for (const searchUrl of searchEngines) {
                try {
                    const response = await axios.get(searchUrl, {
                        headers: {
                            'User-Agent': config.scraping.userAgent,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9'
                        },
                        timeout: config.scraping.timeout
                    });

                    const $ = cheerio.load(response.data);
                    
                    $('a[href*="blog"], a[href*="article"]').each((i, el) => {
                        const url = $(el).attr('href');
                        const title = $(el).text().trim();
                        
                        if (url && title && url.startsWith('http')) {
                            posts.push({
                                title: title,
                                url: url,
                                type: 'blog_post',
                                platform: 'blogs'
                            });
                        }
                    });
                } catch (error) {
                    logger.error(`Error with search engine: ${error.message}`);
                    continue;
                }
            }

            const detailedPosts = [];
            for (const post of posts.slice(0, 50)) {
                try {
                    const details = await this.scrapePost(post.url);
                    if (details && !details.error) {
                        detailedPosts.push({
                            ...post,
                            text: details.text,
                            author: details.author,
                            created: details.created,
                            engagement: details.engagement
                        });
                    }
                } catch (error) {
                    logger.error(`Error scraping blog post ${post.url}: ${error.message}`);
                    continue;
                }
            }

            return {
                posts: detailedPosts,
                totalResults: detailedPosts.length,
                platform: 'blogs'
            };
        } catch (error) {
            logger.error(`Error searching blogs for ${eventName}: ${error.message}`);
            return {
                posts: [],
                totalResults: 0,
                platform: 'blogs'
            };
        }
    },

    async scrapePost(url) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': config.scraping.userAgent
                },
                timeout: config.scraping.timeout
            });

            const $ = cheerio.load(response.data);
            
            const title = $('h1').first().text().trim() || $('title').text().trim();
            
            const paragraphs = [];
            $('article p, .post-content p, .entry-content p, p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 50) {
                    paragraphs.push(text);
                }
            });

            const author = this.extractAuthor($);
            const created = this.extractDate($);
            const comments = this.extractComments($);

            return {
                text: title + '\n' + paragraphs.slice(0, 10).join('\n'),
                author: author,
                created: created,
                engagement: {
                    likes: 0,
                    comments: comments.length,
                    shares: 0
                }
            };
        } catch (error) {
            logger.error(`Blog post scraping error: ${error.message}`);
            return { error: error.message };
        }
    },

    extractAuthor($) {
        const authorSelectors = [
            'meta[name="author"]',
            '[rel="author"]',
            '.author',
            '.author-name',
            '[class*="author"]',
            '[itemprop="author"]'
        ];
        
        for (const selector of authorSelectors) {
            const author = $(selector).first().attr('content') || $(selector).first().text().trim();
            if (author && author.length > 0 && author.length < 100) {
                return author;
            }
        }
        
        return 'Unknown';
    },

    extractDate($) {
        const timeEl = $('time').first().attr('datetime');
        if (timeEl) {
            return new Date(timeEl).toISOString();
        }
        
        const dateSelectors = [
            'meta[property="article:published_time"]',
            'meta[name="publish-date"]',
            '.publish-date',
            '.post-date',
            '[class*="date"]'
        ];
        
        for (const selector of dateSelectors) {
            const date = $(selector).first().attr('content') || $(selector).first().text().trim();
            if (date) {
                try {
                    return new Date(date).toISOString();
                } catch (e) {
                    continue;
                }
            }
        }
        
        return new Date().toISOString();
    },

    extractComments($) {
        const comments = [];
        const commentSelectors = [
            '.comment',
            '.comment-item',
            '[class*="comment"]',
            '#comments li'
        ];
        
        commentSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 20 && text.length < 2000) {
                    comments.push({
                        text: text,
                        user: 'Anonymous'
                    });
                }
            });
        });

        return comments.slice(0, 100);
    }
};

module.exports = blogScraper;