module.exports = {
  async scrape(url) {
    throw new Error('Instagram scraping requires Python service. Use Python API instead.');
  }
};