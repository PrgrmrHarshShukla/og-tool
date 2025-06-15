// sources/nilmamano-blog.js
const { chromium } = require('playwright');
const convertToMarkdown = require('../utils/markdown-converter');

async function scrapeNilDSABlog() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    const items = [];
    const baseUrl = 'https://nilmamano.com';
    
    console.log(`🧮 Starting Nil's DSA blog scraping...`);
    
    // Navigate to main DSA blog page
    await page.goto(`${baseUrl}/blog/category/dsa`, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // Wait for articles to load
    await page.waitForSelector('article', { timeout: 15000 });

    // Extract all blog post links (handling relative URLs)
    const posts = await page.$$eval('article', articles => 
      articles.map(article => {
        const linkEl = article.querySelector('a[href*="/blog/"]');
        if (!linkEl) return null;
        
        const titleEl = article.querySelector('h2, h3, .entry-title, .post-title') || linkEl;
        const excerptEl = article.querySelector('.entry-summary, .post-excerpt, p');
        
        return {
          title: titleEl?.textContent?.trim() || 'Untitled Post',
          excerpt: excerptEl?.textContent?.trim(),
          url: linkEl.getAttribute('href')
        };
      }).filter(Boolean)
    );

    console.log(`📋 Found ${posts.length} DSA blog posts`);
    
    // Scrape each post
    for (let i = 0; i < posts.length; i++) {
      const { title, excerpt, url } = posts[i];
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
      
      console.log(`📖 Scraping (${i+1}/${posts.length}): ${title}`);
      
      try {
        await page.goto(fullUrl, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        // Wait for main content to load
        await page.waitForSelector('.entry-content, article, .post-content', { timeout: 15000 });
        
        const content = await page.evaluate(() => {
          // Try multiple content containers
          const selectors = [
            '.entry-content',
            'article',
            '.post-content',
            '.content',
            'main'
          ];
          
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim().length > 100) {
              return el.innerHTML;
            }
          }
          return '';
        });

        if (content) {
          items.push({
            title: title,
            content: excerpt ? 
              `${excerpt}\n\n${convertToMarkdown(content)}` : 
              convertToMarkdown(content),
            content_type: 'blog',
            source_url: fullUrl,
            author: 'Nil Mamano',
            user_id: ''
          });
          console.log(`✅ Success: ${title}`);
        } else {
          console.log(`⚠️ No content found for: ${title}`);
        }
        
        // Rate limiting
        await page.waitForTimeout(3000);
        
      } catch (error) {
        console.error(`❌ Failed to scrape ${title}:`, error.message);
      }
    }
    
    console.log(`🎉 Extracted ${items.length} DSA blog posts`);
    return {
      team_id: '',
      items: items
    };
    
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeNilDSABlog };