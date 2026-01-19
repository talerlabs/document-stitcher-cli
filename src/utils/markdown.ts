import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";
import MarkdownIt from "markdown-it";
import mathjax3 from "markdown-it-mathjax3";
import { imgSize } from "@mdit/plugin-img-size";
// @ts-expect-error No types available
import attrs from "markdown-it-attrs";
import { Chunk } from "../types";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  xhtmlOut: true,
})
  .use(mathjax3)
  .use(attrs)
  .use(imgSize);

// helper: try to inline a local image file as a data URI. Returns null on
// any failure or if the URL is not a candidate for inlining.
function tryInlineImage(relUrl: string, baseDir: string): string | null {
  // Skip absolute or data URLs
  if (/^(https?:|file:|data:|\/)/i.test(relUrl)) return null;

  const filePath = path.resolve(baseDir, relUrl);
  if (!fs.existsSync(filePath)) return null;

  // Do not inline very large images (safeguard)
  const MAX_INLINE_BYTES = 2 * 1024 * 1024; // 2MB
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_INLINE_BYTES) return null;
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
    };
    const mime = mimeMap[ext] || (ext ? `image/${ext}` : "application/octet-stream");
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Resolves relative links in markdown to absolute file URLs based on the base directory.
 *
 * @param markdown
 * @param baseDir
 * @returns
 */
export function resolveLinks(markdown: string, baseDir: string): string {
  // Resolve non-absolute links (including images) to absolute file:// URLs.
  // Previously image links were skipped unless they pointed to PDFs; convert
  // images too so the HTML contains absolute `file://` URLs and Puppeteer can
  // load local image files reliably.
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  return markdown.replace(linkRegex, (match, text, url, offset, original) => {
    const isImage = offset > 0 && original[offset - 1] === "!";
    const isPdf = /\.pdf($|\?|#)/i.test(url);

    // If this is an image and NOT a PDF, try to inline it. If inlining
    // fails, leave the markdown unchanged so `<base>` can resolve it later.
    if (isImage && !isPdf) {
      const dataUrl = tryInlineImage(url, baseDir);
      if (dataUrl) {
        // The regex match does not include the preceding '!' for image
        // syntax, so the original string already contains the '!'. If we
        // returned a replacement that also included '!' we'd end up with
        // a double '!!' which renders as a literal '!' followed by the
        // image. Return the bracketed image link only so the original
        // '!' remains and the final markdown is correct.
        return `[${text}](${dataUrl})`;
      }
      return match;
    }

    // Skip if already absolute (starts with http, https, file://, or /)
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("file://") ||
      url.startsWith("/")
    ) {
      return match;
    }

    // Resolve relative path and return an absolute file:// URL for non-image
    // links and for images that point to PDFs (we still need to resolve
    // embedded PDF image links so the PDF embedding logic can find the file).
    const resolvedPath = path.resolve(baseDir, url);
    // Use pathToFileURL to get a correctly-formed file URL (file:/// on Windows)
    const fileUrl = pathToFileURL(resolvedPath).href;
    return `[${text}](${fileUrl})`;
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
  // Match markdown image links that point to PDFs. The alt text may contain
  // inline page option specifiers using the syntax:
  //   skip: use "!=1,2,3" (e.g. `![pdf !=1,2](./file.pdf)`)
  //   include: use "=1,2,3" (e.g. `![pdf =3,4](./file.pdf)`)
  // We capture the alt text as the first group and the PDF path as the second.
  const pdfLinkRegex = /!\[([^\]]+)\]\(([^)]+\.pdf)\)/g;
  const chunks: Chunk[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pdfLinkRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: "markdown", content: markdown.substring(lastIndex, match.index) });
    }

    const path = match[2];
    if (!path) continue;

    // Parse options embedded in the alt text (match[1]). Examples:
    //  - "pdf !=1,2"  -> skip: [1,2]
    //  - "pdf =3,4"   -> include: [3,4]
    const altText = match[1] || "";
    let pageOptions: { skip?: number[]; include?: number[] } = {};

    // Find all operator occurrences in the alt text. Operators are either
    // '!=' for skip or '=' for include, followed by a comma-separated list
    // of page numbers. We allow optional whitespace.
    const optionPattern = /(!=|=)\s*([0-9]+(?:\s*,\s*[0-9]+)*)/g;
    const opMatches = Array.from(altText.matchAll(optionPattern));

    if (opMatches.length > 0) {
      const hasSkip = opMatches.some((m) => m[1] === "!=");
      const hasInclude = opMatches.some((m) => m[1] === "=");
      if (hasSkip && hasInclude) {
        throw new Error(`Cannot specify both 'skip' and 'include' options for PDF: ${path}`);
      }

      // Only handle the first match for the specified operator (others ignored
      // unless both types are present which we reject above).
      const m = opMatches[0]!;
      const op = m[1]!;
      const nums = m[2]!;
      const parsed = nums
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));

      if (op === "!=") {
        pageOptions.skip = parsed;
      } else if (op === "=") {
        pageOptions.include = parsed;
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
