import requests
from datetime import datetime

class RedditScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def scrape_post(self, url):
        try:
            json_url = url + '.json' if not url.endswith('.json') else url
            
            response = requests.get(json_url, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if isinstance(data, list) and len(data) > 0:
                post = data[0]['data']['children'][0]['data']
                comments_data = data[1]['data']['children'] if len(data) > 1 else []
                
                return {
                    'url': url,
                    'post_text': post.get('title', '') + '\n' + post.get('selftext', ''),
                    'author': post.get('author', 'unknown'),
                    'subreddit': post.get('subreddit', 'unknown'),
                    'comments': self._parse_comments(comments_data),
                    'likes': post.get('ups', 0) - post.get('downs', 0),
                    'upvotes': post.get('ups', 0),
                    'downvotes': post.get('downs', 0),
                    'upvote_ratio': post.get('upvote_ratio', 0),
                    'shares': 0,
                    'timestamp': datetime.fromtimestamp(post.get('created_utc', 0)).isoformat(),
                    'awards': post.get('total_awards_received', 0),
                    'post_type': post.get('post_hint', 'text')
                }
            
            return {'error': 'Invalid Reddit data structure'}
        
        except Exception as e:
            return {'error': f'Reddit scraping failed: {str(e)}'}
    
    def scrape_profile(self, url):
        try:
            json_url = url + '.json' if not url.endswith('.json') else url
            
            response = requests.get(json_url, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            username = url.split('/')[-1] if url.split('/')[-1] else 'unknown'
            posts = []
            
            if 'data' in data and 'children' in data['data']:
                for item in data['data']['children'][:10]:
                    post_data = item['data']
                    post_url = f"https://www.reddit.com{post_data.get('permalink', '')}"
                    post = self.scrape_post(post_url)
                    if 'error' not in post:
                        posts.append(post)
            
            return {
                'username': username,
                'followers': 0,
                'following': 0,
                'posts_count': len(posts),
                'posts': posts
            }
        
        except Exception as e:
            return {'error': f'Reddit profile scraping failed: {str(e)}'}
    
    def _parse_comments(self, comments_data):
        comments = []
        
        def extract_comments(items):
            for item in items:
                if item.get('kind') == 't1' and 'data' in item:
                    comment = item['data']
                    comments.append({
                        'user': comment.get('author', 'unknown'),
                        'text': comment.get('body', ''),
                        'likes': comment.get('ups', 0) - comment.get('downs', 0),
                        'timestamp': datetime.fromtimestamp(comment.get('created_utc', 0)).isoformat(),
                        'replies_count': 0,
                        'awards': comment.get('total_awards_received', 0)
                    })
                    
                    if 'replies' in comment and isinstance(comment['replies'], dict):
                        if 'data' in comment['replies'] and 'children' in comment['replies']['data']:
                            extract_comments(comment['replies']['data']['children'])
        
        extract_comments(comments_data)
        return comments