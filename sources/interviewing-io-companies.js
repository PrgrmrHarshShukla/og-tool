// sources/interviewing-io-companies.js
const { chromium } = require('playwright');
const convertToMarkdown = require('../utils/markdown-converter');

async function scrapeCompanyGuides() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    const items = [];
    
    console.log(`🏢 Starting company guides scraping...`);
    
    await page.goto('https://interviewing.io/topics#companies', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // More flexible waiting strategy
    await page.waitForFunction(() => {
      const shrinkDiv = document.querySelector('div.shrink');
      return shrinkDiv && shrinkDiv.querySelector('section');
    }, { timeout: 15000 });

    // Get the first section within div.shrink
    const firstSection = await page.$('div.shrink section'); // no >, gets the first section anywhere inside
    if (!firstSection) {
      throw new Error('❌ Could not find a <section> in div.shrink');
    }

    // Extract all links from that section that contain "/guides/hiring-process"
    const companyLinks = await firstSection.$$eval(
      'a[href*="/guides/hiring-process"]',
      anchors => anchors.map(a => ({
        title: a.textContent.trim(),
        url: a.href,
        relativePath: a.getAttribute('href'),
      }))
    );

    console.log(`📋 Found ${companyLinks.length} company guide links`);


    
    // Scrape each company guide
    for (let i = 0; i < companyLinks.length; i++) {
      const { title, url, relativePath } = companyLinks[i];
      console.log(`📖 Scraping (${i+1}/${companyLinks.length}): ${title}`);
      
      try {
        // Handle relative URLs properly
        const guideUrl = url.startsWith('http') ? url : `https://interviewing.io${relativePath}`;
        
        await page.goto(guideUrl, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        // More flexible content waiting
        await page.waitForFunction(() => {
          const bodyText = document.body.textContent || '';
          return bodyText.length > 500;
        }, { timeout: 15000 });

        // Extract content from likely containers
        const content = await page.evaluate(() => {
          const contentSelectors = [
            'div.prose',
            'article',
            'main',
            '.content-wrapper',
            '.post-content',
            'section',
            'div[class*="content"]'
          ];

          for (const selector of contentSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim().length > 100) {
              return el.innerHTML;
            }
          }
          return document.body.innerHTML; // Fallback
        });

        if (content) {
          items.push({
            title: `Company Guide: ${title}`,
            content: convertToMarkdown(content),
            content_type: 'guide',
            source_url: guideUrl,
            author: 'interviewing.io',
            user_id: ''
          });
          console.log(`✅ Success: ${title}`);
        } else {
          console.log(`⚠️ No substantial content found for: ${title}`);
        }
        
        // Rate limiting
        await page.waitForTimeout(3000);
        
      } catch (error) {
        console.error(`❌ Failed to scrape ${title}:`, error.message);
      }
    }
    
    console.log(`🎉 Extracted ${items.length} company guides`);
    return {
      team_id: '',
      items: items
    };
    
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeCompanyGuides };