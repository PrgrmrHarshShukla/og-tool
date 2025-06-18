// scraper.js
const { scrapeLink } = require('./sources/link-scraper');
const { scrapePDF } = require("./sources/pdf-scraper")

async function mainScraper(teamId, config) {
  const results = {
    team_id: teamId,
    items: []
  };

  try {
    if(config.scrapeLink) {
      console.log("Starting link scraping...");

      for(const link in config.urls) {
        console.log("\nScraping: ", link, "\n");
        const linkResults = await scrapeLink(link);
        results.items.push(linkResults);
      }
    }

    if(config.scrapePDF) {
      console.log("Starting PDF Scraping...");
      const pdfResults = await scrapePDF(config.pdfUrl);
      results.items.push(...pdfResults.items);
    }
    
    console.log(`✅ Scraping complete. Total items: ${results.items.length}`);
    return results;
    
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  }
}

module.exports = mainScraper;