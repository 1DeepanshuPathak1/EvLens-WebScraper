module.exports = {
  async scrape(url) {
    throw new Error('Twitter scraping requires Python service. Use Python API instead.');
  }
};