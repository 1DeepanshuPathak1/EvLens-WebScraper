from playwright.sync_api import sync_playwright
import re
import time
from datetime import datetime

class TwitterScraper:
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
                retweets = self._extract_retweets(page)
                timestamp = self._extract_timestamp(page)
                author = self._extract_author(page)
                
                return {
                    'url': url,
                    'post_text': post_text,
                    'author': author,
                    'comments': comments,
                    'likes': likes,
                    'shares': retweets,
                    'timestamp': timestamp,
                    'post_type': 'tweet'
                }
            
            except Exception as e:
                return {'error': f'Twitter scraping failed: {str(e)}'}
            
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
                tweet_urls = self._extract_tweet_urls(page)
                
                posts = []
                for tweet_url in tweet_urls[:10]:
                    post_data = self.scrape_post(tweet_url)
                    if 'error' not in post_data:
                        posts.append(post_data)
                
                return {
                    'username': username,
                    'followers': followers,
                    'following': following,
                    'posts_count': len(tweet_urls),
                    'posts': posts
                }
            
            except Exception as e:
                return {'error': f'Twitter profile scraping failed: {str(e)}'}
            
            finally:
                browser.close()
    
    def _extract_post_text(self, page):
        try:
            selectors = ['[data-testid="tweetText"]', 'article div[lang]']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    return el.inner_text().strip()
            return ''
        except:
            return ''
    
    def _extract_comments(self, page):
        comments = []
        try:
            page.wait_for_selector('[data-testid="reply"]', timeout=5000)
            comment_elements = page.query_selector_all('article')
            
            for el in comment_elements[:30]:
                try:
                    text_el = el.query_selector('[data-testid="tweetText"]')
                    author_el = el.query_selector('[data-testid="User-Name"]')
                    
                    if text_el and author_el:
                        comments.append({
                            'user': author_el.inner_text().strip().split('\n')[0],
                            'text': text_el.inner_text().strip(),
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
            selectors = ['[data-testid="like"]', '[aria-label*="like"]']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    aria_label = el.get_attribute('aria-label')
                    if aria_label:
                        match = re.search(r'([\d,]+)', aria_label)
                        if match:
                            return int(match.group(1).replace(',', ''))
            return 0
        except:
            return 0
    
    def _extract_retweets(self, page):
        try:
            selectors = ['[data-testid="retweet"]', '[aria-label*="retweet"]']
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    aria_label = el.get_attribute('aria-label')
                    if aria_label:
                        match = re.search(r'([\d,]+)', aria_label)
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
            el = page.query_selector('[data-testid="User-Name"]')
            if el:
                return el.inner_text().strip().split('\n')[0]
            return 'unknown'
        except:
            return 'unknown'
    
    def _extract_username(self, page):
        try:
            el = page.query_selector('[data-testid="UserName"]')
            if el:
                return el.inner_text().strip()
            return 'unknown'
        except:
            return 'unknown'
    
    def _extract_followers(self, page):
        try:
            el = page.query_selector('a[href*="/followers"] span')
            if el:
                text = el.inner_text().strip()
                return self._parse_number(text)
            return 0
        except:
            return 0
    
    def _extract_following(self, page):
        try:
            el = page.query_selector('a[href*="/following"] span')
            if el:
                text = el.inner_text().strip()
                return self._parse_number(text)
            return 0
        except:
            return 0
    
    def _extract_tweet_urls(self, page):
        urls = []
        try:
            links = page.query_selector_all('a[href*="/status/"]')
            for link in links[:20]:
                href = link.get_attribute('href')
                if href:
                    full_url = f'https://twitter.com{href}' if not href.startswith('http') else href
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