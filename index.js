const mainScraper = require('./scraper');
const fs = require('fs');
const path = require('path');

function parseInputArgs() {
  const args = process.argv.slice(2);

  // Default config: everything off
  const config = {
    scrapeUrl: false,
    scrapePDF: false,
    urls: [],
    pdfUrl: ''
  };

  if (args.length === 0) return config;

  for (const input of args) {
    if (input.toLowerCase().endsWith('.pdf')) {
      config.scrapePDF = true;
      config.pdfUrl = path.resolve(input);
    } 
    else {
      const url = new URL(input);
      config.urls.push(url);
      config.scrapeUrl = true;
    }
  }

  return config;
}

async function run() {
  const config = parseInputArgs();
  const date = Date.now();

  console.log("Config:\n", config);
  

  const result = await mainScraper('aline123', config);

  const outputPath = `output-${date}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`✅ Scraping completed! Results saved to ${outputPath}`);
}

run().catch(console.error);
