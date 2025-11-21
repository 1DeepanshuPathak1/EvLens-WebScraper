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
        # Pass event_name to scrape_profile if the method supports it
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
        
        if platform not in scrapers:
            return jsonify({'error': f'Unsupported platform: {platform}'}), 400
        
        logger.info(f'Searching {platform} for: {hashtag}')
        
        scraper = scrapers[platform]
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
    app.run(host='0.0.0.0', port=5000, debug=True)