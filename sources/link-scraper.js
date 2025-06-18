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
      if (e.isFull) {
        // For full URLs, just return as-is (but could filter to same domain)
        return e.fullUrl.startsWith(givenURL.origin) ? e.fullUrl : null;
      }
      
      // For relative URLs
      try {
        const url = new URL(e.fullUrl, givenURL.origin);
        return url.toString();
      } catch (err) {
        console.warn(`Invalid URL: ${e.fullUrl}`);
        return null;
      }
    }).filter(url => url !== null);

    const contentLinks = [...new Set(fullLinks)];
    console.log(`📋 Found ${contentLinks.length} content links`);


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
    // A comprehensive selector list that includes container classes
    const linkSelectors = [
      'a[href*="/blog/"]',
      'a[href*="/topics/"]',
      'a[href*="/guide/"]',
      'a[href*="/guides/"]',
      'article a[href]',
      'section a[href]',
      'div[class*="card"] a[href]',
      'div[class*="topic"] a[href]',
      'div[class*="company"] a[href]',
      'div[class*="item"] a[href]',
      'div[class*="content"] a[href]',
      'div[class*="post"] a[href]',
      '.post-preview a[href]',
      '.blog-list a[href]',
      '.topic-list a[href]',
      '.company-list a[href]',
      'h1 a[href]',
      'h2 a[href]',
      'h3 a[href]',
      'h4 a[href]'
    ];
    
    const links = new Set();
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    
    // First pass: Try specific selectors
    for (const selector of linkSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => processLinkElement(el, links, currentOrigin));
    }
    
    // Second pass: Fallback to all links if we didn't find enough
    if (links.size < 5) {
      const allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach(el => processLinkElement(el, links, currentOrigin));
    }
    
    function processLinkElement(el, linksSet, origin) {
      try {
        const href = el.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        
        let fullUrl;
        
        if (href.startsWith('http')) {
          fullUrl = href;
        } else if (href.startsWith('//')) {
          fullUrl = window.location.protocol + href;
        } else if (href.startsWith('/')) {
          fullUrl = origin + href;
        } else {
          const baseDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
          fullUrl = origin + baseDir + href;
        }
        
        // Normalize URL
        fullUrl = fullUrl.replace(new RegExp(`${origin}${origin}`, 'g'), origin);
        fullUrl = fullUrl.replace(/([^:]\/)\/+/g, '$1');
        
        // Filter criteria
        const isSameOrigin = fullUrl.startsWith(origin);
        const isContentLink = /(\/blog\/|\/topics\/|\/posts\/|\/article\/|\/guide\/|\/guides\/)/i.test(fullUrl);
        const isNotAsset = !/\.(pdf|jpg|png|gif|css|js|svg|ico)$/i.test(fullUrl);
        
        if (isSameOrigin && (isContentLink || linksSet.size < 10) && isNotAsset) {
          linksSet.add({
            isFull: fullUrl.startsWith('http'),
            fullUrl: fullUrl
          });
        }
      } catch (e) {
        console.warn('Error processing link:', e);
      }
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