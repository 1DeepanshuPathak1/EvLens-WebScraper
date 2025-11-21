import instaloader
from datetime import datetime
import time
import re
import requests
from bs4 import BeautifulSoup
import os
import json

class InstagramScraper:
    def __init__(self):
        self.loader = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,  # Disable to avoid login requirement
            save_metadata=False,
            compress_json=False,
            post_metadata_txt_pattern='',
            max_connection_attempts=3,
            quiet=True
        )
        
        print("Instagram scraper initialized (no login required)")
    
    def scrape_post(self, url):
        """Scrape a single Instagram post by URL using public data"""
        try:
            shortcode = self._extract_shortcode(url)
            if not shortcode:
                return {'error': 'Invalid Instagram URL'}
            
            # Get post using Instaloader (works without login for public posts)
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
            
            # Extract basic post data (available without login)
            post_type = 'reel' if post.is_video else 'post'
            
            # Get comments count and likes (these are available publicly)
            likes = post.likes if hasattr(post, 'likes') else 0
            comment_count = post.comments if hasattr(post, 'comments') else 0
            video_views = post.video_view_count if (post.is_video and hasattr(post, 'video_view_count')) else 0
            
            # Try to get comments using alternative method
            comments = self._extract_comments_alternative(shortcode, limit=50)
            
            return {
                'url': url,
                'post_text': post.caption if post.caption else '',
                'author': post.owner_username,
                'comments': comments,
                'likes': likes,
                'shares': 0,
                'timestamp': post.date_utc.isoformat(),
                'post_type': post_type,
                'video_views': video_views,
                'comment_count': comment_count,
                'engagement_rate': self._calculate_engagement_simple(likes, comment_count, video_views)
            }
        except Exception as e:
            print(f"Error scraping post: {str(e)}")
            return {'error': f'Instagram post scraping failed: {str(e)}'}
    
    def _extract_comments_alternative(self, shortcode, limit=50):
        """Extract comments using Instagram's public GraphQL API"""
        comments = []
        try:
            # Instagram's public post URL
            url = f'https://www.instagram.com/p/{shortcode}/?__a=1&__d=dis'
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    # Navigate through the JSON structure to find comments
                    if 'graphql' in data or 'items' in data:
                        # Try different JSON structures Instagram uses
                        post_data = None
                        
                        if 'graphql' in data and 'shortcode_media' in data['graphql']:
                            post_data = data['graphql']['shortcode_media']
                        elif 'items' in data and len(data['items']) > 0:
                            post_data = data['items'][0]
                        
                        if post_data and 'edge_media_to_parent_comment' in post_data:
                            edges = post_data['edge_media_to_parent_comment']['edges']
                            
                            for edge in edges[:limit]:
                                node = edge['node']
                                comments.append({
                                    'user': node.get('owner', {}).get('username', 'unknown'),
                                    'author': node.get('owner', {}).get('username', 'unknown'),
                                    'text': node.get('text', ''),
                                    'likes': node.get('edge_liked_by', {}).get('count', 0),
                                    'timestamp': datetime.fromtimestamp(node.get('created_at', 0)).isoformat()
                                })
                        
                        print(f"Extracted {len(comments)} comments via API")
                except json.JSONDecodeError:
                    print("Could not parse Instagram API response")
        except Exception as e:
            print(f"Alternative comment extraction failed: {str(e)}")
        
        # If API method failed, create placeholder comments to show structure
        if len(comments) == 0:
            print("Using public data only (comments require Instagram login)")
            # Return empty list - comments require authentication
        
        return comments
    
    def scrape_profile(self, url, event_name=None):
        """Scrape posts from an Instagram profile"""
        try:
            username = self._extract_username_from_url(url)
            if not username:
                return {'error': 'Invalid Instagram profile URL'}
            
            profile = instaloader.Profile.from_username(self.loader.context, username)
            
            posts = []
            post_count = 0
            limit = 20
            
            print(f"Scraping profile: {username} (up to {limit} posts)")
            
            for post in profile.get_posts():
                if post_count >= limit:
                    break
                
                try:
                    post_type = 'reel' if post.is_video else 'post'
                    
                    likes = post.likes if hasattr(post, 'likes') else 0
                    comment_count = post.comments if hasattr(post, 'comments') else 0
                    video_views = post.video_view_count if (post.is_video and hasattr(post, 'video_view_count')) else 0
                    
                    # Try to get comments for this post
                    comments = self._extract_comments_alternative(post.shortcode, limit=20)
                    
                    post_data = {
                        'url': f'https://www.instagram.com/p/{post.shortcode}/',
                        'post_text': post.caption if post.caption else '',
                        'author': post.owner_username,
                        'comments': comments,
                        'likes': likes,
                        'shares': 0,
                        'timestamp': post.date_utc.isoformat(),
                        'post_type': post_type,
                        'video_views': video_views,
                        'comment_count': comment_count,
                        'engagement_rate': self._calculate_engagement_simple(likes, comment_count, video_views)
                    }
                    
                    posts.append(post_data)
                    post_count += 1
                    print(f"  ✓ Scraped post {post_count}/{limit}: {likes} likes, {comment_count} comments")
                    
                    time.sleep(1)  # Rate limiting
                
                except Exception as e:
                    print(f"Error processing post: {str(e)}")
                    continue
            
            return {
                'username': profile.username,
                'followers': profile.followers,
                'following': profile.followees,
                'posts_count': profile.mediacount,
                'posts': posts,
                'platform': 'instagram',
                'biography': profile.biography if hasattr(profile, 'biography') else '',
                'is_verified': profile.is_verified if hasattr(profile, 'is_verified') else False,
                'is_private': profile.is_private
            }
        except Exception as e:
            print(f"Profile scraping error: {str(e)}")
            return {'error': f'Instagram profile scraping failed: {str(e)}'}
    
    def search_posts(self, query, limit=10):
        """Search for posts by event name using Google search"""
        if 'instagram.com/' in query and '/p/' not in query and '/reel/' not in query:
            return self.scrape_profile(query)
        
        if '/p/' in query or '/reel/' in query:
            post_data = self.scrape_post(query)
            if 'error' not in post_data:
                return {
                    'platform': 'instagram',
                    'query': query,
                    'posts': [post_data],
                    'total_results': 1
                }
            return post_data
        
        print(f"Searching Google for Instagram posts about: {query}")
        instagram_urls = self._google_search_instagram(query, limit)
        
        if not instagram_urls:
            print(f"No Instagram URLs found for query: {query}")
            return {
                'platform': 'instagram',
                'query': query,
                'posts': [],
                'total_results': 0
            }
        
        posts = []
        for url in instagram_urls:
            try:
                post_data = self.scrape_post(url)
                if 'error' not in post_data:
                    posts.append(post_data)
                    print(f"Successfully scraped: {url}")
                else:
                    print(f"Failed to scrape: {url} - {post_data.get('error')}")
                time.sleep(1)
            except Exception as e:
                print(f"Error scraping {url}: {str(e)}")
                continue
        
        return {
            'platform': 'instagram',
            'query': query,
            'posts': posts,
            'total_results': len(posts)
        }
    
    def _google_search_instagram(self, event_name, limit=10):
        """Search Google for Instagram posts/reels related to the event"""
        instagram_urls = []
        
        search_queries = [
            f'{event_name} instagram reel',
            f'{event_name} instagram post',
            f'{event_name} site:instagram.com/reel',
            f'{event_name} site:instagram.com/p'
        ]
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive'
        }
        
        for search_query in search_queries:
            if len(instagram_urls) >= limit:
                break
            
            try:
                print(f"Searching Google for: {search_query}")
                
                google_url = f"https://www.google.com/search?q={requests.utils.quote(search_query)}&num=20"
                
                response = requests.get(google_url, headers=headers, timeout=15)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    
                    if 'instagram.com' in href:
                        instagram_url = None
                        
                        if href.startswith('https://www.instagram.com') or href.startswith('http://www.instagram.com'):
                            instagram_url = href
                        elif '/url?q=' in href:
                            match = re.search(r'/url\?q=([^&]+)', href)
                            if match:
                                decoded_url = requests.utils.unquote(match.group(1))
                                if 'instagram.com' in decoded_url:
                                    instagram_url = decoded_url
                        else:
                            match = re.search(r'(https?://(?:www\.)?instagram\.com/(?:p|reel)/[A-Za-z0-9_-]+)', href)
                            if match:
                                instagram_url = match.group(1)
                        
                        if instagram_url:
                            if '/p/' in instagram_url or '/reel/' in instagram_url:
                                clean_url = instagram_url.split('?')[0].split('#')[0]
                                
                                if re.match(r'https?://(?:www\.)?instagram\.com/(?:p|reel)/[A-Za-z0-9_-]+/?$', clean_url):
                                    if clean_url not in instagram_urls:
                                        instagram_urls.append(clean_url)
                                        print(f"✓ Found Instagram URL: {clean_url}")
                                        
                                        if len(instagram_urls) >= limit:
                                            break
                
                if len(instagram_urls) < limit:
                    time.sleep(3)
                
            except Exception as e:
                print(f"Error during Google search for '{search_query}': {str(e)}")
                continue
        
        print(f"\nFinal count: {len(instagram_urls)} Instagram URLs found")
        return instagram_urls[:limit]
    
    def _extract_shortcode(self, url):
        """Extract shortcode from Instagram post URL"""
        patterns = [
            r'instagram\.com/p/([A-Za-z0-9_-]+)',
            r'instagram\.com/reel/([A-Za-z0-9_-]+)',
            r'instagram\.com/tv/([A-Za-z0-9_-]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def _extract_username_from_url(self, url):
        """Extract username from Instagram profile URL"""
        url = url.rstrip('/').split('?')[0]
        pattern = r'instagram\.com/([A-Za-z0-9._]+)/?$'
        match = re.search(pattern, url)
        if match:
            return match.group(1)
        return None
    
    def _calculate_engagement_simple(self, likes, comments, views):
        """Calculate engagement rate"""
        try:
            total_engagement = likes + comments
            if views > 0:
                return round((total_engagement / views) * 100, 2)
            return 0
        except:
            return 0