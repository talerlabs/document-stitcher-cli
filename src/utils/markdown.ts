import * as path from "path";
import MarkdownIt from "markdown-it";
import mathjax3 from "markdown-it-mathjax3";
import { imgSize } from "@mdit/plugin-img-size";
import { Chunk } from "../types";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  xhtmlOut: true,
})
  .use(mathjax3)
  .use(imgSize);

/**
 * Resolves relative links in markdown to absolute file URLs based on the base directory.
 *
 * @param markdown
 * @param baseDir
 * @returns
 */
export function resolveLinks(markdown: string, baseDir: string): string {
  // Only resolve non-absolute links that point to PDFs.
  // Image links are of the form `![alt](...)`. We skip image links UNLESS they
  // point to a PDF (images that reference PDFs should still be resolved).
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  return markdown.replace(linkRegex, (match, text, url, offset, original) => {
    const isImage = offset > 0 && original[offset - 1] === "!";
    const isPdf = /\.pdf($|\?|#)/i.test(url);

    // If this is an image and NOT a PDF, leave it alone. If it's an image
    // that references a PDF, resolve it like a normal link.
    if (isImage && !isPdf) return match;

    // Skip if already absolute (starts with http, https, file://, or /)
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("file://") ||
      url.startsWith("/")
    ) {
      return match;
    }

    // Resolve relative path and return an absolute file:// URL
    const resolvedPath = path.resolve(baseDir, url);
    const absPath = resolvedPath.replace(/\\/g, "/");
    return `[${text}](file://${absPath})`;
  });
}

function applyPagebreaks(markdown: string): string {
  // Emit an inline-styled div to force a page break when printing/PDF
  return markdown.replace(/\\pagebreak/g, '<div style="page-break-after: always;"></div>');
}

/**
 * Converts markdown content to HTML, handling custom image size syntax and page breaks.
 *
 * @param markdown
 * @returns
 */
export function convertMarkdownToHtml(markdown: string): string {
  markdown = applyPagebreaks(markdown);
  return md.render(markdown);
}

/**
 * Convert markdown into chunks of markdown and PDF references.
 *
 * @param markdown
 * @returns
 */
export function parseMarkdownIntoChunks(markdown: string): Chunk[] {
  const pdfLinkRegex = /!\[([^\]]+)\]\(([^)]+\.pdf)\)(?:\{([^}]*)\})?/g;
  const chunks: Chunk[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pdfLinkRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: "markdown", content: markdown.substring(lastIndex, match.index) });
    }

    const path = match[2];
    if (!path) continue;
    const optionsStr = match[3] || "";
    let pageOptions: { skip?: number[]; include?: number[] } = {};

    if (optionsStr.trim()) {
      const skipMatch = optionsStr.match(/skip:\s*\[([^\]]*)\]/);
      const includeMatch = optionsStr.match(/include:\s*\[([^\]]*)\]/);

      if (skipMatch && includeMatch) {
        throw new Error(`Cannot specify both 'skip' and 'include' options for PDF: ${path}`);
      }

      if (skipMatch && skipMatch[1]) {
        pageOptions.skip = skipMatch[1]
          .split(",")
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));
      } else if (includeMatch && includeMatch[1]) {
        pageOptions.include = includeMatch[1]
          .split(",")
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));
      }
    }

    chunks.push({ type: "pdf", path: decodeURIComponent(path), pageOptions });
    lastIndex = pdfLinkRegex.lastIndex;
  }

  if (lastIndex < markdown.length) {
    chunks.push({ type: "markdown", content: markdown.substring(lastIndex) });
  }

  return chunks;
}
