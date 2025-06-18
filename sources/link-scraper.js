// sources/interviewing-io-blog.js
const { chromium } = require('playwright');
const convertToMarkdown = require('../utils/markdown-converter');

async function scrapeLink(givenURL) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    const items = [];
    
    console.log(`🔍 Starting blog scraping...`);

    const mainURL = givenURL ? givenURL : 'https://interviewing.io/blog';
    
    // Navigate to main blog page
    await page.goto(mainURL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 1. Get all potential blog links
    const blogLinks = await getBlogLinks(page);
    // console.log(`📋 Found ${blogLinks.length} blog post links`);
    
    if (blogLinks.length === 0) {
      console.log(`⚠️ No blog links found. Trying to scrape current page as single post...`);
      const currentPageItem = await scrapeSingleBlogPage(page);
      if (currentPageItem) items.push(currentPageItem);
      return items;
    }

    // 2. Scrape each blog post (with rate limiting)
    for (let i = 0; i < blogLinks.length; i++) {
      const link = blogLinks[i];
      console.log(`📖 Scraping (${i+1}/${blogLinks.length}): ${link}`);
      
      try {
        await page.goto(link, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        // Wait for content to load
        await page.waitForSelector('body', { timeout: 5000 });
        await page.waitForTimeout(1000); // Additional wait for dynamic content
        
        const item = await scrapeSingleBlogPage(page);
        // console.log("Related ITEM:", item);
        
        if (item) {
          items.push(item);
          console.log(`✅ Success: "${item.title}"`);
        }
        
        // Rate limiting
        await page.waitForTimeout(2000 + Math.random() * 1000);
        
      } catch (error) {
        console.error(`❌ Failed to scrape ${link}:`, error.message);
      }
    }
    
    console.log(`🎉 Completed scraping: ${items.length} posts extracted`);
    // console.log("ALL items:\n", items);
    return {
      team_id: '', // You can add this from config
      items: items
    };
    
  } finally {
    await browser.close();
  }
}

// Helper functions (not exported)
async function getBlogLinks(page) {
  return await page.evaluate(() => {
    const linkSelectors = [
      'a[href*="/blog/"]', 
      'article a[href]',
      '.post-preview a[href]',
      '.blog-list a[href]',
      'h2 a[href]',
      'h3 a[href]'
    ];
    
    const links = new Set();
    
    for (const selector of linkSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const href = el.getAttribute('href');
        if (href && href.includes('blog') && !href.includes('#')) {
          const fullUrl = href.startsWith('http') ? href : 
            `https://interviewing.io${href.startsWith('/') ? href : `/${href}`}`;
          links.add(fullUrl);
        }
      });
      
      if (links.size > 0) break;
    }
    
    return Array.from(links);
  });
}

async function scrapeSingleBlogPage(page) {
  try {
    const pageData = await page.evaluate(() => {
      // Content extraction
      const contentSelectors = [
        'article', 
        '.post-content',
        '.blog-content',
        '.entry-content',
        'main',
        '.content',
        'section',
        'div[class*="content"]',
        'div[class*="post"]',
        'div[class*="article"]',
        'div[class*="body"]',
        'div[class*="text"]'
      ];
      
      let bestContent = '';
      let bestSelector = '';
      let maxLength = 0;
      
      for (const selector of contentSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = el.textContent?.trim() || '';
          if (text.length > maxLength) {
            maxLength = text.length;
            bestContent = text;
            bestSelector = selector;
          }
        }
      }
      
      if (maxLength < 500) {
        bestContent = document.body.textContent?.trim() || '';
        bestSelector = 'body';
        maxLength = bestContent.length;
      }
      
      // Title extraction
      const titleSelectors = [
        'h1',
        '.post-title',
        '.entry-title',
        '.title',
        'header h1',
        'header h2',
        '[class*="title"]',
        '[class*="heading"]'
      ];
      
      let title = '';
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent?.trim()) {
          title = el.textContent.trim();
          break;
        }
      }
      
      // Author extraction
      const authorSelectors = [
        '.author',
        '.byline',
        '.post-author',
        '[class*="author"]',
        '[class*="by"]',
        'footer',
        '.meta'
      ];
      
      let author = '';
      for (const selector of authorSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent?.trim()) {
          const text = el.textContent.trim();
          if (text.length < 100 && text.toLowerCase().includes('by')) {
            author = text;
            break;
          }
        }
      }
      
      return {
        title: title || document.title,
        content: bestContent,
        author: author || 'interviewing.io',
        selectorUsed: bestSelector,
        contentLength: maxLength
      };
    });
    
    if (!pageData.content || pageData.contentLength < 100) {
      console.warn(`⚠️ Low content length (${pageData.contentLength}) using selector: ${pageData.selectorUsed}`);
      return null;
    }
    
    return {
      title: pageData.title,
      content: convertToMarkdown(pageData.content),
      content_type: givenURL ? "other" : 'blog',
      source_url: page.url(),
      author: pageData.author,
      user_id: '' // You can add this from config
    };
    
  } catch (error) {
    console.error('Error scraping single blog page:', error);
    return null;
  }
}

module.exports = { scrapeLink };