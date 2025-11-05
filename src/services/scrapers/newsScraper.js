const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');
const config = require('../../config/scraperConfig');

const newsScraper = {
    async searchEvent(eventName, startDate, endDate) {
        try {
            logger.info(`Searching news for event: ${eventName} between ${startDate} and ${endDate}`);
            
            const allPosts = [];
            const sources = [
                'https://news.google.com/rss/search',
                'https://www.bing.com/news/search'
            ];

            const searchQuery = encodeURIComponent(eventName);
            
            for (const source of sources) {
                try {
                    let searchUrl;
                    if (source.includes('google')) {
                        searchUrl = `${source}?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en`;
                    } else {
                        searchUrl = `${source}?q=${searchQuery}&format=rss`;
                    }

                    const response = await axios.get(searchUrl, {
                        headers: {
                            'User-Agent': config.scraping.userAgent,
                            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                        },
                        timeout: config.scraping.timeout
                    });

                    if (source.includes('google')) {
                        const posts = this.parseGoogleNewsRSS(response.data, eventName);
                        allPosts.push(...posts);
                    } else {
                        const $ = cheerio.load(response.data);
                        const posts = this.parseBingNews($, eventName);
                        allPosts.push(...posts);
                    }
                } catch (error) {
                    logger.error(`Error fetching from ${source}: ${error.message}`);
                    continue;
                }
            }

            const detailedPosts = [];
            for (const post of allPosts.slice(0, 100)) {
                try {
                    const details = await this.scrapeArticle(post.url);
                    if (details && !details.error) {
                        detailedPosts.push({
                            ...post,
                            text: details.text || post.text,
                            engagement: details.engagement || { likes: 0, comments: 0, shares: 0 }
                        });
                    } else {
                        detailedPosts.push(post);
                    }
                } catch (error) {
                    detailedPosts.push(post);
                    continue;
                }
            }

            return {
                posts: detailedPosts,
                totalResults: detailedPosts.length,
                platform: 'news'
            };
        } catch (error) {
            logger.error(`Error searching news for ${eventName}: ${error.message}`);
            return {
                posts: [],
                totalResults: 0,
                platform: 'news'
            };
        }
    },

    parseGoogleNewsRSS(xmlData, eventName) {
        const posts = [];
        const $ = cheerio.load(xmlData, { xmlMode: true });
        
        $('item').each((i, item) => {
            const $item = $(item);
            const title = $item.find('title').text().trim();
            const link = $item.find('link').text().trim();
            const pubDate = $item.find('pubDate').text().trim();
            const description = $item.find('description').text().trim();
            const source = $item.find('source').text().trim();

            if (title && link) {
                posts.push({
                    title: title,
                    text: description || title,
                    url: link,
                    author: source || 'News Source',
                    created: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    type: 'news_article',
                    source: source || 'Unknown',
                    engagement: {
                        likes: 0,
                        comments: 0,
                        shares: 0
                    }
                });
            }
        });

        return posts;
    },

    parseBingNews($, eventName) {
        const posts = [];
        
        $('.news-card, .newsitem, article').each((i, el) => {
            const $el = $(el);
            const title = $el.find('.title, h2, h3').first().text().trim();
            const url = $el.find('a').first().attr('href');
            const source = $el.find('.source, .publisher').first().text().trim();
            const date = $el.find('.date, time').first().text().trim();

            if (title && url) {
                posts.push({
                    title: title,
                    text: title,
                    url: url.startsWith('http') ? url : 'https://www.bing.com' + url,
                    author: source || 'News Source',
                    created: date ? new Date(date).toISOString() : new Date().toISOString(),
                    type: 'news_article',
                    source: source || 'Unknown',
                    engagement: {
                        likes: 0,
                        comments: 0,
                        shares: 0
                    }
                });
            }
        });

        return posts;
    },

    async scrapeArticle(url) {
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
            $('article p, .article-content p, .story-body p, p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 50) {
                    paragraphs.push(text);
                }
            });

            const comments = this.extractComments($);

            return {
                text: title + '\n' + paragraphs.slice(0, 15).join('\n'),
                engagement: {
                    likes: 0,
                    comments: comments.length,
                    shares: 0
                }
            };
        } catch (error) {
            logger.error(`News article scraping error: ${error.message}`);
            return { error: error.message };
        }
    },

    extractComments($) {
        const comments = [];
        const commentSelectors = [
            '.comment',
            '.comment-item',
            '[class*="comment"]',
            '.discussion-item'
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

module.exports = newsScraper;