// sources/pdf-scraper.js
const { PDFExtract } = require('pdf.js-extract');
const convertToMarkdown = require('../utils/markdown-converter');
const path = require('path');

const pdfExtract = new PDFExtract();

async function scrapePDF(pdfPath) {
  try {
    console.log(`📖 Processing PDF: ${pdfPath}`);

    const { pages, meta } = await new Promise((resolve, reject) => {
      pdfExtract.extract(pdfPath, {}, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const pageTexts = pages.map((page, i) => {
      const text = page.content.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
      return text;
    });

    const tocPageIndex = 8; // page 9 in 0-index
    const tocText = pageTexts[tocPageIndex];

    const chapterPages = parseTableOfContents(tocText);
    // console.log(`🔍 Parsed TOC Chapters:`, chapterPages);

    // Filter chapters 0-8 specifically
    const targetChapters = chapterPages.filter(
      ch => ch.chapter >= 1 && ch.chapter <= 8
    );

    console.log(`🎯 Found ${targetChapters.length} target chapters (Ch 0–8)`);

    const chapters = [];

    for (const ch of targetChapters) {
      const start = ch.startPage - 1; // 0-based index
      const end = ch.endPage - 1;     // inclusive

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


function parseTableOfContents(tocText) {
  console.log('📥 Parsing TOC text for chapter entries...');

  // Split based on the occurrence of "Ch X." (with optional leading space)
  const parts = tocText.split(/(?=Ch\s+\d+\.)/g).slice(1);

  const res = [];

  for (const part of parts) {
    if (part.startsWith("Ch 9.")) break;

    const trimmed = part.trim();
    // console.log('\n\n📄 TOC Segment:\n', trimmed);

    const pcs = trimmed.split(".");

    const chNum = pcs[0].slice(3);
    const startPg = pcs[pcs.length - 1];

    res.push({
      chapter: parseInt(chNum) + 1,
      startPage: parseInt(startPg),
      name: pcs[1].trim()
    })

    
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