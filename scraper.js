// scraper.js
const { scrapeBlogPosts } = require('./sources/interviewing-io-blog');
const { scrapeCompanyGuides } = require('./sources/interviewing-io-companies');
const { scrapeInterviewGuides } = require('./sources/interviewing-io-interview-guide');
const { scrapeNilDSABlog } = require('./sources/nilmamano-blog');
const { scrapePDF } = require("./sources/pdf-scraper")

async function mainScraper(teamId, config) {
  const results = {
    team_id: teamId,
    items: []
  };

  try {
    if (config.scrapeInterviewingIoBlog) {
      console.log('Starting interviewing.io blog scraping...');
      const blogResults = await scrapeBlogPosts(config.generalUrl);
      results.items.push(blogResults);
    }
    
    if (config.scrapeCompanyGuides) {
      console.log('Starting company guides scraping...');
      const companyResults = await scrapeCompanyGuides();
      results.items.push(...companyResults.items);
    }
    
    if (config.scrapeInterviewGuides) {
      console.log('Starting interview guides scraping...');
      const interviewResults = await scrapeInterviewGuides();
      results.items.push(...interviewResults.items);
    }
    
    if (config.scrapeNilDSABlog) {
      console.log("Starting Nil's DSA blog scraping...");
      const dsaResults = await scrapeNilDSABlog();
      results.items.push(...dsaResults.items);
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