// sources/pdf-scraper.js
const { PDFExtract } = require('pdf.js-extract');
const convertToMarkdown = require('../utils/markdown-converter');
const path = require('path');

const pdfExtract = new PDFExtract();

// Common phrases that might indicate a TOC page
const TOC_PHRASES = [
  'table of contents',
  'contents',
  'table of content',
  'what\'s inside',
  'whats inside',
  'in this book',
  'chapters at a glance'
];

async function scrapePDF(pdfPath) {
  try {
    console.log(`📖 Processing PDF: ${pdfPath}`);

    const { pages, meta } = await new Promise((resolve, reject) => {
      pdfExtract.extract(pdfPath, {}, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const totalPages = pages.length;
    console.log(`📄 Found ${totalPages} pages`);

    const pageTexts = pages.map((page, i) => {
      const text = page.content.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
      return text;
    });

    // Find the TOC page dynamically
    const tocPageIndex = findTocPage(pageTexts);
    if (tocPageIndex === -1) {
      throw new Error('Could not find Table of Contents page');
    }
    console.log(`🔍 Found TOC at page ${tocPageIndex + 1}`);

    const tocText = pageTexts[tocPageIndex];
    const chapterPages = parseTableOfContents(tocText);

    const chapters = [];

    for (const ch of chapterPages) {
      const start = ch.startPage - 1; // 0-based index
      const end = ch.endPage - 1;     // inclusive

      if (start > totalPages || end > totalPages) {
        console.log("\n⚠️ Exceeded pdf size!\n");
        break;
      }

      console.log(`📘 Extracting Ch ${ch.chapter}: "${ch.name}" from page ${start + 1} to ${end + 1}`);

      const chapterText = pageTexts.slice(start, end + 1).join('\n\n');

      chapters.push({
        title: `Ch ${ch.chapter}: ${ch.name}`,
        content: chapterText,
        startPage: ch.startPage,
        chapterNumber: ch.chapter
      });
    }

    console.log(`📚 Extracted ${chapters.length} chapters`);

    return {
      team_id: '',
      items: chapters.map(ch => ({
        title: ch.title,
        content: convertToMarkdown(ch.content),
        content_type: 'book_chapter',
        source_url: `file://${path.resolve(pdfPath)}#page=${ch.startPage}`,
        author: meta?.info?.Author || '',
        user_id: ''
      }))
    };

  } catch (error) {
    console.error('❌ PDF processing failed:', error);
    throw error;
  }
}

function findTocPage(pageTexts, maxPagesToCheck = 20) {
  console.log('🔎 Searching for Table of Contents page...');
  
  // Check only the first few pages (TOC is usually at the beginning)
  const pagesToCheck = Math.min(maxPagesToCheck, pageTexts.length);
  
  for (let i = 0; i < pagesToCheck; i++) {
    const text = pageTexts[i].toLowerCase();
    
    // Check for any TOC indicator phrases
    if (TOC_PHRASES.some(phrase => text.includes(phrase))) {
      return i;
    }
    
    // Additional check for chapter listings pattern
    if (text.match(/ch(apter)?\s+\d+/i)) {
      return i;
    }
  }
  
  // Fallback: If no TOC found by phrases, look for the first page with "Ch X" pattern
  for (let i = 0; i < pagesToCheck; i++) {
    if (pageTexts[i].match(/Ch\s+\d+\./)) {
      return i;
    }
  }
  
  return -1;
}

function parseTableOfContents(tocText) {
  console.log('📥 Parsing TOC text for chapter entries...');

  // Split based on the occurrence of "Ch X." (with optional leading space)
  const parts = tocText.split(/(?=Ch\s+\d+\.)/g).slice(1);

  const res = [];

  for (const part of parts) {
    const trimmed = part.trim();
    const pcs = trimmed.split(".");

    const chNum = pcs[0].slice(3);
    const startPg = pcs[pcs.length - 1];

    res.push({
      chapter: parseInt(chNum) + 1,
      startPage: parseInt(startPg),
      name: pcs[1].trim()
    });
  }  
  
  const finalRes = [];

  for(let i = 0; i < res.length - 1; i++) {
    const obj = {
      chapter: res[i].chapter,
      startPage: res[i].startPage,
      endPage: res[i+1].startPage - 1,
      name: res[i].name
    }
    finalRes.push(obj);
  }

  return finalRes;
}

module.exports = { scrapePDF };