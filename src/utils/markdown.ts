import * as path from 'path';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';
import { imgSize } from "@mdit/plugin-img-size";
import { Chunk } from '../types';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  xhtmlOut: true
})
  .use(mathjax3)
  .use(imgSize);

export function resolveLinks(markdown: string, baseDir: string): string {
  // Regex to match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  return markdown.replace(linkRegex, (match, text, url) => {
    // Skip if already absolute (starts with http, https, file://, or /)
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://') || url.startsWith('/')) {
      return match;
    }
    // Resolve relative path
    const resolvedPath = path.resolve(baseDir, url);
    // Convert to file:// URL
    const fileUrl = 'file://' + resolvedPath.replace(/\\/g, '/');
    return `[${text}](${fileUrl})`;
  });
}

export function convertMarkdownToHtml(markdown: string): string {
  // Convert new image size format {height: X, width: Y} to old format =YxX
  const imageSizeRegex = /!\[([^\]]+)\]\(([^)]+)\)\{([^}]+)\}/g;
  markdown = markdown.replace(imageSizeRegex, (match, alt, url, sizeSpec) => {
    // Parse the size specification like "height: 600, width: 300"
    const sizeMatch = sizeSpec.match(/height:\s*(\d+),\s*width:\s*(\d+)/);
    if (sizeMatch) {
      const height = sizeMatch[1];
      const width = sizeMatch[2];

      // The same is important
      return `![${alt} =${width}x${height}](${url})`;
    }
    return match; // Return unchanged if format doesn't match
  });

  // Replace \pagebreak with HTML page break div
  markdown = markdown.replace(/\\pagebreak/g, '<div style="page-break-after: always;"></div>');

  return md.render(markdown);
}

// Helper function to parse markdown into chunks
export function parseMarkdownIntoChunks(markdown: string): Chunk[] {
  const pdfLinkRegex = /\!\[([^\]]+)\]\(([^)]+\.pdf)\)(?:\{([^}]*)\})?/g;
  const chunks: Chunk[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pdfLinkRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: 'markdown', content: markdown.substring(lastIndex, match.index) });
    }

    const path = match[2];
    if (!path) continue;
    const optionsStr = match[3] || '';
    let pageOptions: { skip?: number[]; include?: number[] } | undefined;

    if (optionsStr.trim()) {
      const skipMatch = optionsStr.match(/skip:\s*\[([^\]]*)\]/);
      const includeMatch = optionsStr.match(/include:\s*\[([^\]]*)\]/);

      if (skipMatch && includeMatch) {
        throw new Error(`Cannot specify both 'skip' and 'include' options for PDF: ${path}`);
      }

      pageOptions = {};
      if (skipMatch && skipMatch[1]) {
        pageOptions.skip = skipMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      } else if (includeMatch && includeMatch[1]) {
        pageOptions.include = includeMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      }
    }

    chunks.push({ type: 'pdf', path: decodeURIComponent(path), pageOptions });
    lastIndex = pdfLinkRegex.lastIndex;
  }

  if (lastIndex < markdown.length) {
    chunks.push({ type: 'markdown', content: markdown.substring(lastIndex) });
  }

  return chunks;
}