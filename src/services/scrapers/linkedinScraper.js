module.exports = {
  async scrape(url) {
    throw new Error('LinkedIn scraping requires Python service. Use Python API instead.');
  }
};