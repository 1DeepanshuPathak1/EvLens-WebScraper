const express = require('express');
const router = express.Router();
const scraperController = require('../controllers/scraperController');
const validator = require('../middleware/validator');

router.post('/scrape', validator.validateScrapeRequest, scraperController.scrapeUrl);
router.post('/scrape-multiple', validator.validateMultipleScrapeRequest, scraperController.scrapeMultipleUrls);
router.post('/scrape-profile', validator.validateProfileScrapeRequest, scraperController.scrapeProfile);
router.get('/supported-platforms', scraperController.getSupportedPlatforms);

module.exports = router;