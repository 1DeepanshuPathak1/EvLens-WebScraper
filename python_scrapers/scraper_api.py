from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from scrapers.instagram_scraper import InstagramScraper
from scrapers.twitter_scraper import TwitterScraper
from scrapers.linkedin_scraper import LinkedInScraper
from scrapers.reddit_scraper import RedditScraper

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scrapers = {}

def get_scraper(platform):
    """Lazy load scrapers to avoid startup failures"""
    if platform not in scrapers:
        try:
            if platform == 'instagram':
                from scrapers.instagram_scraper import InstagramScraper
                scrapers[platform] = InstagramScraper()
            elif platform == 'twitter':
                from scrapers.twitter_scraper import TwitterScraper
                scrapers[platform] = TwitterScraper()
            elif platform == 'linkedin':
                from scrapers.linkedin_scraper import LinkedInScraper
                scrapers[platform] = LinkedInScraper()
            elif platform == 'reddit':
                from scrapers.reddit_scraper import RedditScraper
                scrapers[platform] = RedditScraper()
            else:
                return None
        except Exception as e:
            logger.error(f"Failed to load {platform} scraper: {str(e)}")
            return None
    return scrapers.get(platform)

@app.route('/', methods=['GET', 'HEAD'])
def root():
    return jsonify({'status': 'OK', 'service': 'Python Scraper API'})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'Python Scraper API'})

@app.route('/scrape', methods=['POST'])
def scrape():
    try:
        data = request.json
        url = data.get('url')
        platform = data.get('platform', '').lower()
        event_name = data.get('event_name', '')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        scraper = get_scraper(platform)
        if not scraper:
            return jsonify({'error': f'Unsupported platform: {platform}'}), 400
        
        logger.info(f'Scraping {platform} URL: {url}')
        
        result = scraper.scrape_post(url)
        result['event_name'] = event_name
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Scraping error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/scrape-profile', methods=['POST'])
def scrape_profile():
    try:
        data = request.json
        url = data.get('url')
        platform = data.get('platform', '').lower()
        event_name = data.get('event_name', '')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        scraper = get_scraper(platform)
        if not scraper:
            return jsonify({'error': f'Unsupported platform: {platform}'}), 400
        
        logger.info(f'Scraping {platform} profile: {url}')
        
        if platform == 'instagram':
             result = scraper.scrape_profile(url, event_name=event_name)
        else:
             result = scraper.scrape_profile(url)
        
        result['event_name'] = event_name
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Profile scraping error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/search-posts', methods=['POST'])
def search_posts():
    try:
        data = request.json
        hashtag = data.get('hashtag', '')
        platform = data.get('platform', '').lower()
        event_name = data.get('event_name', '')
        limit = data.get('limit', 10)
        
        if not hashtag:
            return jsonify({'error': 'Hashtag is required'}), 400
        
        scraper = get_scraper(platform)
        if not scraper:
            return jsonify({'error': f'Unsupported platform: {platform}'}), 400
        
        logger.info(f'Searching {platform} for: {hashtag}')
        
        if hasattr(scraper, 'search_posts'):
            result = scraper.search_posts(hashtag, limit)
            result['event_name'] = event_name
            return jsonify(result)
        else:
            return jsonify({'error': f'{platform} search not implemented'}), 501
    
    except Exception as e:
        logger.error(f'Search error: {str(e)}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)