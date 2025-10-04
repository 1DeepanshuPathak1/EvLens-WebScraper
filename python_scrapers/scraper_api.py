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

scrapers = {
    'instagram': InstagramScraper(),
    'twitter': TwitterScraper(),
    'linkedin': LinkedInScraper(),
    'reddit': RedditScraper()
}

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
        
        if platform not in scrapers:
            return jsonify({'error': f'Unsupported platform: {platform}'}), 400
        
        logger.info(f'Scraping {platform} URL: {url}')
        
        scraper = scrapers[platform]
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
        
        if platform not in scrapers:
            return jsonify({'error': f'Unsupported platform: {platform}'}), 400
        
        logger.info(f'Scraping {platform} profile: {url}')
        
        scraper = scrapers[platform]
        result = scraper.scrape_profile(url)
        result['event_name'] = event_name
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f'Profile scraping error: {str(e)}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)