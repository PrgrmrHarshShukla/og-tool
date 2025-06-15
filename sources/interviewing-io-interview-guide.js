// sources/interviewing-io-interview-guide.js
const { chromium } = require('playwright');
const convertToMarkdown = require('../utils/markdown-converter');

async function scrapeInterviewGuides() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    const items = [];
    const baseUrl = 'https://interviewing.io';

    console.log(`📚 Starting interview guides scraping...`);

    await page.goto(`${baseUrl}/learn#interview-guides`, {
      waitUntil: 'networkidle',
      timeout: 45000
    });

    // Wait for guide links to appear
    await page.waitForSelector('a[href^="/guides/"]', { timeout: 15000 });

    // Extract first 3 unique guide links
    const guideLinks = await page.$$eval('a[href^="/guides/"]', anchors => {
      const seen = new Set();
      const results = [];

      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (!seen.has(href)) {
          seen.add(href);
          results.push({
            title: a.querySelector('h2')?.textContent.trim() || a.textContent.trim().slice(0, 80),
            url: href
          });
        }
        if (results.length >= 3) break;
      }

      return results;
    });

    console.log(`🔗 Found ${guideLinks.length} guide links to scrape`);

    // Scrape each guide page
    for (let i = 0; i < guideLinks.length; i++) {
      const { title, url } = guideLinks[i];
      const fullUrl = baseUrl + url;
      console.log(`📖 Scraping (${i + 1}/${guideLinks.length}): ${title}`);
      console.log(`🔍 Navigating to ${fullUrl}`);

      try {
        await page.goto(fullUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });

        await page.waitForTimeout(3000);

        // Wait for content to render
        await page.waitForSelector('main, div, article', { timeout: 15000 });

        // Extract meaningful content
        const content = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('main, article, div')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && el.innerText.length > 200;
          });

          let best = '';
          let maxLength = 0;
          for (const el of candidates) {
            const html = el.innerHTML;
            if (html.length > maxLength) {
              best = html;
              maxLength = html.length;
            }
          }
          return best;
        });

        if (content && content.trim().length > 0) {
          items.push({
            title: `Interview Guide: ${title}`,
            content: convertToMarkdown(content),
            content_type: 'guide',
            source_url: fullUrl,
            author: 'interviewing.io',
            user_id: ''
          });
          console.log(`✅ Success: ${title}`);
        } else {
          console.log(`⚠️ No content found for: ${title}`);
        }

        // Optional delay between requests
        await page.waitForTimeout(2000);

      } catch (error) {
        console.error(`❌ Failed to scrape ${title}:`, error.message);
      }
    }

    console.log(`🎉 Extracted ${items.length} interview guides`);
    return {
      team_id: '',
      items
    };

  } finally {
    await browser.close();
  }
}

module.exports = { scrapeInterviewGuides };
