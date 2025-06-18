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
      const link = new URL(input);
      config.urls.push({
        href: link.href,
        origin: link.origin,
        host: link.host,
        pathname: link.pathname,
        hash: link.hash
      });
      config.scrapeUrl = true;
    }
  }

  return config;
}

async function run() {
  const config = parseInputArgs();
  const date = Date.now();

  const result = await mainScraper('aline123', config);

  const outputPath = `output-${date}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  console.log(`✅ Scraping completed! Results saved to ${outputPath}`);
}

run().catch(console.error);
