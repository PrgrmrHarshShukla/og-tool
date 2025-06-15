const mainScraper = require('./scraper');
const fs = require('fs');
const path = require('path');

function parseInputArgs() {
  const args = process.argv.slice(2);

  // Default config: everything off
  const config = {
    scrapeInterviewingIoBlog: false,
    scrapeCompanyGuides: false,
    scrapeInterviewGuides: false,
    scrapeNilDSABlog: false,
    scrapePDF: false,
    generalUrl: '',
    pdfUrl: ''
  };

  if (args.length === 0) {
    config.scrapeInterviewingIoBlog = true;
    config.scrapeCompanyGuides = true;
    config.scrapeInterviewGuides = true;
    config.scrapeNilDSABlog = true;
    config.scrapePDF = true;
    config.pdfUrl = 'C:/Users/91991/Downloads/OGTool_assignment_Aline_book.pdf';
    // config.pdfUrl = 'path/to/book/pdf';


    return config;
  }

  for (const input of args) {
    if (input.startsWith('http')) {
      const url = new URL(input);

      if (url.hostname.includes('interviewing.io')) {
        if (url.pathname.includes('/blog')) {
          config.scrapeInterviewingIoBlog = true;
        } else if (url.pathname.includes('/learn')) {
          config.scrapeInterviewGuides = true;
        } else if (url.pathname.includes('/guides')) {
          config.scrapeCompanyGuides = true;
        }
      } else if (url.hostname.includes('nilmamano')) {
        config.scrapeNilDSABlog = true;
      } else {
        console.warn(`⚠️ Unknown domain: ${url.hostname}. Defaulting to general scraping.`);
        config.scrapeInterviewingIoBlog = true;
        config.generalUrl = input;
      }
    } else if (input.toLowerCase().endsWith('.pdf')) {
      config.scrapePDF = true;
      config.pdfUrl = path.resolve(input);
    } else {
      console.warn(`⚠️ Ignored unknown input: ${input}`);
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
