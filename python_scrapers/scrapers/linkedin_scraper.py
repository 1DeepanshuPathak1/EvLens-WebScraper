from playwright.sync_api import sync_playwright
import re
import time
from datetime import datetime

class LinkedInScraper:
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
                all_comments = self._extract_all_comments(page)
                reactions = self._extract_reactions(page)
                timestamp = self._extract_timestamp(page)
                author = self._extract_author(page)
                
                return {
                    'url': url,
                    'post_text': post_text,
                    'author': author,
                    'comments': all_comments,
                    'likes': reactions,
                    'shares': 0,
                    'timestamp': timestamp,
                    'post_type': 'post'
                }
            
            except Exception as e:
                return {'error': f'LinkedIn scraping failed: {str(e)}'}
            
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
                connections = self._extract_connections(page)
                post_urls = self._extract_post_urls(page)
                
                posts = []
                for post_url in post_urls[:10]:
                    post_data = self.scrape_post(post_url)
                    if 'error' not in post_data:
                        posts.append(post_data)
                
                return {
                    'username': username,
                    'followers': connections,
                    'following': 0,
                    'posts_count': len(post_urls),
                    'posts': posts
                }
            
            except Exception as e:
                return {'error': f'LinkedIn profile scraping failed: {str(e)}'}
            
            finally:
                browser.close()
    
    def _extract_post_text(self, page):
        try:
            selectors = ['.feed-shared-text', '[class*="feed-shared-update-v2__description"]', '.feed-shared-update-v2__description']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    return el.inner_text().strip()
            return ''
        except:
            return ''
    
    def _extract_all_comments(self, page):
        comments = []
        try:
            self._scroll_to_load_comments(page)
            
            comment_selectors = [
                '.comments-comment-item',
                '[class*="comment"]',
                '.comment'
            ]
            
            for selector in comment_selectors:
                try:
                    comment_elements = page.query_selector_all(selector)
                    
                    for el in comment_elements[:100]:
                        try:
                            author_el = el.query_selector('.comments-comment-item__commenter-name, [class*="commenter-name"]')
                            text_el = el.query_selector('.comments-comment-item-content-body, [class*="comment-body"]')
                            
                            if text_el:
                                comment_text = text_el.inner_text().strip()
                                author = author_el.inner_text().strip() if author_el else 'unknown'
                                
                                if comment_text and len(comment_text) > 2:
                                    comments.append({
                                        'user': author,
                                        'author': author,
                                        'text': comment_text,
                                        'likes': 0,
                                        'timestamp': datetime.now().isoformat()
                                    })
                        except:
                            continue
                    
                    if len(comments) > 0:
                        break
                except:
                    continue
        except:
            pass
        
        return comments
    
    def _scroll_to_load_comments(self, page):
        try:
            for _ in range(3):
                page.evaluate('window.scrollBy(0, 500)')
                time.sleep(1)
        except:
            pass
    
    def _extract_reactions(self, page):
        try:
            selectors = ['.social-details-social-counts__reactions-count', '[aria-label*="reaction"]', '[class*="reaction"]']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    text = el.inner_text().strip()
                    match = re.search(r'([\d,]+)', text)
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
            selectors = ['.feed-shared-actor__name', '[class*="actor-name"]']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    return el.inner_text().strip()
            return 'unknown'
        except:
            return 'unknown'
    
    def _extract_username(self, page):
        try:
            el = page.query_selector('h1')
            if el:
                return el.inner_text().strip()
            return 'unknown'
        except:
            return 'unknown'
    
    def _extract_connections(self, page):
        try:
            el = page.query_selector('.pv-top-card--list-bullet li')
            if el:
                text = el.inner_text().strip()
                return self._parse_number(text)
            return 0
        except:
            return 0
    
    def _extract_post_urls(self, page):
        urls = []
        try:
            links = page.query_selector_all('a[href*="/posts/"]')
            for link in links[:20]:
                href = link.get_attribute('href')
                if href:
                    full_url = f'https://www.linkedin.com{href}' if not href.startswith('http') else href
                    urls.append(full_url)
            return list(set(urls))
        except:
            return []
    
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