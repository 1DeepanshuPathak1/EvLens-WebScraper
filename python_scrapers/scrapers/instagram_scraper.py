from playwright.sync_api import sync_playwright
import re
import time
from datetime import datetime

class InstagramScraper:
    def __init__(self):
        self.user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    
    def scrape_post(self, url):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=self.user_agent)
            page = context.new_page()
            
            try:
                page.goto(url, wait_until='networkidle', timeout=30000)
                time.sleep(3)
                
                post_text = self._extract_post_text(page)
                comments = self._extract_comments(page)
                likes = self._extract_likes(page)
                timestamp = self._extract_timestamp(page)
                author = self._extract_author(page)
                
                return {
                    'url': url,
                    'post_text': post_text,
                    'author': author,
                    'comments': comments,
                    'likes': likes,
                    'shares': 0,
                    'timestamp': timestamp,
                    'post_type': self._detect_post_type(url)
                }
            
            except Exception as e:
                return {'error': f'Instagram scraping failed: {str(e)}'}
            
            finally:
                browser.close()
    
    def scrape_profile(self, url):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=self.user_agent)
            page = context.new_page()
            
            try:
                page.goto(url, wait_until='networkidle', timeout=30000)
                time.sleep(3)
                
                username = self._extract_username(page)
                followers = self._extract_followers(page)
                following = self._extract_following(page)
                posts_count = self._extract_posts_count(page)
                post_urls = self._extract_post_urls(page)
                
                posts = []
                for post_url in post_urls[:10]:
                    post_data = self.scrape_post(post_url)
                    if 'error' not in post_data:
                        posts.append(post_data)
                
                return {
                    'username': username,
                    'followers': followers,
                    'following': following,
                    'posts_count': posts_count,
                    'posts': posts
                }
            
            except Exception as e:
                return {'error': f'Instagram profile scraping failed: {str(e)}'}
            
            finally:
                browser.close()
    
    def _extract_post_text(self, page):
        try:
            selectors = ['h1', 'article span', '[class*="Caption"]']
            for selector in selectors:
                elements = page.query_selector_all(selector)
                for el in elements:
                    text = el.inner_text().strip()
                    if text and len(text) > 10:
                        return text
            return ''
        except:
            return ''
    
    def _extract_comments(self, page):
        comments = []
        try:
            page.wait_for_selector('ul li', timeout=5000)
            comment_elements = page.query_selector_all('ul li')
            
            for el in comment_elements[:50]:
                try:
                    text = el.inner_text().strip()
                    if text and len(text) > 2:
                        user_match = re.match(r'^(\S+)\s+(.+)', text)
                        if user_match:
                            user = user_match.group(1)
                            comment_text = user_match.group(2)
                        else:
                            user = 'unknown'
                            comment_text = text
                        
                        comments.append({
                            'user': user,
                            'text': comment_text,
                            'likes': 0,
                            'timestamp': datetime.now().isoformat()
                        })
                except:
                    continue
        except:
            pass
        
        return comments
    
    def _extract_likes(self, page):
        try:
            selectors = ['section button span', '[class*="like"]', 'section a']
            for selector in selectors:
                elements = page.query_selector_all(selector)
                for el in elements:
                    text = el.inner_text().strip()
                    match = re.search(r'([\d,]+)\s*like', text, re.IGNORECASE)
                    if match:
                        return int(match.group(1).replace(',', ''))
            return 0
        except:
            return 0
    
    def _extract_timestamp(self, page):
        try:
            time_el = page.query_selector('time')
            if time_el:
                datetime_attr = time_el.get_attribute('datetime')
                if datetime_attr:
                    return datetime_attr
            return datetime.now().isoformat()
        except:
            return datetime.now().isoformat()
    
    def _extract_author(self, page):
        try:
            selectors = ['header a', '[class*="Username"]']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    return el.inner_text().strip()
            return 'unknown'
        except:
            return 'unknown'
    
    def _extract_username(self, page):
        try:
            el = page.query_selector('header h2, header h1')
            if el:
                return el.inner_text().strip()
            return 'unknown'
        except:
            return 'unknown'
    
    def _extract_followers(self, page):
        try:
            el = page.query_selector('a[href*="followers"] span')
            if el:
                text = el.inner_text().strip()
                return self._parse_number(text)
            return 0
        except:
            return 0
    
    def _extract_following(self, page):
        try:
            el = page.query_selector('a[href*="following"] span')
            if el:
                text = el.inner_text().strip()
                return self._parse_number(text)
            return 0
        except:
            return 0
    
    def _extract_posts_count(self, page):
        try:
            elements = page.query_selector_all('header span, header li')
            for el in elements:
                text = el.inner_text().strip()
                if 'post' in text.lower():
                    match = re.search(r'([\d,]+)', text)
                    if match:
                        return int(match.group(1).replace(',', ''))
            return 0
        except:
            return 0
    
    def _extract_post_urls(self, page):
        urls = []
        try:
            links = page.query_selector_all('article a')
            for link in links[:20]:
                href = link.get_attribute('href')
                if href and '/p/' in href:
                    full_url = f'https://www.instagram.com{href}' if not href.startswith('http') else href
                    urls.append(full_url)
            return list(set(urls))
        except:
            return []
    
    def _detect_post_type(self, url):
        if '/reel/' in url:
            return 'reel'
        elif '/p/' in url:
            return 'post'
        elif '/tv/' in url:
            return 'video'
        return 'post'
    
    def _parse_number(self, text):
        multipliers = {'K': 1000, 'M': 1000000, 'B': 1000000000}
        match = re.search(r'([\d.]+)([KMB])?', text, re.IGNORECASE)
        if match:
            num = float(match.group(1))
            mult = match.group(2)
            if mult:
                num *= multipliers.get(mult.upper(), 1)
            return int(num)
        return 0