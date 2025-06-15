// utils/markdown-converter.js
const turndown = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

function convertToMarkdown(html) {
  const td = new turndown({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
  
  td.use(turndownPluginGfm.gfm);
  
  // Add custom rules for code blocks, etc.
  td.addRule('code', {
    filter: ['pre'],
    replacement: (content, node) => {
      const language = node.getAttribute('class')?.match(/language-(\w+)/)?.[1] || '';
      return `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
    }
  });
  
  return td.turndown(html);
}

module.exports = convertToMarkdown;