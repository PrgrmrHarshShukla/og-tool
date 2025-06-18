const { chromium } = require('playwright');
const convertToMarkdown = require('../utils/markdown-converter');

async function scrapeLink(givenURL) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const mainURL = givenURL.href;

  try {
    const items = [];
    
    // Navigate to main page
    await page.goto(mainURL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 1. Get all potential links
    const rawLinks = await getContentLinks(page);
    const fullLinks = rawLinks.map((e) => {
      return e.isFull ? e.fullUrl : `${givenURL.href}${e.fullUrl}`
    })
    const contentLinks = [...new Set(fullLinks)];

    // console.log("\nAll content links:\n", contentLinks);
    console.log(`📋 Found ${contentLinks.length} content links`);

    // return;
    
    
    if (contentLinks.length === 0) {
      console.log(`⚠️ No content links found. Trying to scrape current page as single post...`);
      const currentPageItem = await scrapeSingleContentPage(page, givenURL);
      if (currentPageItem) items.push(currentPageItem);
      return items;
    }

    // 2. Scrape each content link (with rate limiting)
    for (let i = 0; i < contentLinks.length; i++) {
      const link = contentLinks[i];
      console.log(`📖 Scraping (${i+1}/${contentLinks.length}): ${link}`);
      
      try {
        await page.goto(link, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        // Wait for content to load
        await page.waitForSelector('body', { timeout: 5000 });
        await page.waitForTimeout(1000); // Additional wait for dynamic content
        
        const item = await scrapeSingleContentPage(page, givenURL);
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
    
    console.log(`🎉 Completed scraping: ${items.length} items extracted`);
    console.log("ALL items:\n", items);
    return {
      team_id: '',
      items: items
    };
    
  } finally {
    await browser.close();
  }
}

async function getContentLinks(page) {
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
        const a_href = el.getAttribute('href');
        if (a_href) {
          const isFull = a_href.startsWith('http');
          const fullUrl = a_href.startsWith('http') ? a_href : 
            `${a_href.startsWith('/') ? a_href : `/${a_href}`}`;

          if(fullUrl) {
            links.add({
              isFull,
              fullUrl
            });
          }
        }
      });
    }

    return Array.from(links);
  });
}

async function scrapeSingleContentPage(page, givenURL) {
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
        'div[class*="text"]',
        'span',
        'div'
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
        author: author || "",
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
      user_id: ''
    };
    
  } catch (error) {
    console.error('Error scraping single blog page:', error);
    return null;
  }
}

module.exports = { scrapeLink };