import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

class GenericScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def scrape_post(self, url):
        try:
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            title = self._extract_title(soup)
            content = self._extract_content(soup)
            comments = self._extract_comments(soup)
            author = self._extract_author(soup)
            timestamp = self._extract_timestamp(soup)
            
            return {
                'url': url,
                'post_text': title + '\n' + content,
                'author': author,
                'comments': comments,
                'likes': 0,
                'shares': 0,
                'timestamp': timestamp,
                'post_type': 'article'
            }
        
        except Exception as e:
            return {'error': f'Generic scraping failed: {str(e)}'}
    
    def scrape_profile(self, url):
        return {'error': 'Profile scraping not supported for generic URLs'}
    
    def _extract_title(self, soup):
        title_tag = soup.find('h1')
        if title_tag:
            return title_tag.get_text(strip=True)
        
        title_tag = soup.find('title')
        if title_tag:
            return title_tag.get_text(strip=True)
        
        return ''
    
    def _extract_content(self, soup):
        paragraphs = []
        for p in soup.find_all('p'):
            text = p.get_text(strip=True)
            if len(text) > 20:
                paragraphs.append(text)
        
        return '\n'.join(paragraphs[:10])
    
    def _extract_comments(self, soup):
        comments = []
        comment_selectors = [
            {'class': re.compile(r'comment', re.I)},
            {'id': re.compile(r'comment', re.I)}
        ]
        
        for selector in comment_selectors:
            comment_elements = soup.find_all(attrs=selector)
            for el in comment_elements[:30]:
                text = el.get_text(strip=True)
                if 10 < len(text) < 1000:
                    comments.append({
                        'user': 'Anonymous',
                        'text': text,
                        'likes': 0,
                        'timestamp': datetime.now().isoformat()
                    })
        
        return comments[:50]
    
    def _extract_author(self, soup):
        author_meta = soup.find('meta', attrs={'name': 'author'})
        if author_meta and author_meta.get('content'):
            return author_meta['content']
        
        author_selectors = [
            {'class': re.compile(r'author', re.I)},
            {'rel': 'author'}
        ]
        
        for selector in author_selectors:
            author_el = soup.find(attrs=selector)
            if author_el:
                text = author_el.get_text(strip=True)
                if text:
                    return text
        
        return 'Unknown'
    
    def _extract_timestamp(self, soup):
        time_tag = soup.find('time')
        if time_tag and time_tag.get('datetime'):
            return time_tag['datetime']
        
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',
            r'\d{2}/\d{2}/\d{4}'
        ]
        
        body_text = soup.get_text()
        for pattern in date_patterns:
            match = re.search(pattern, body_text)
            if match:
                try:
                    return datetime.fromisoformat(match.group(0)).isoformat()
                except:
                    pass
        
        return datetime.now().isoformat()