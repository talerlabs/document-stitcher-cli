import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { Chunk, PdfSource } from "../types";
import { convertMarkdownToHtml, resolveLinks } from "./markdown";

// @ts-expect-error CSS import fails here unfortunately
import defaultCssFile from "../templates/styles/default.css" with { type: "file" };
import templateFile from "../templates/base.html" with { type: "file" };

/**
 * Converts HTML content to a PDF file.
 *
 * @param html
 * @param outputFilePath
 */
export async function convertHtmlToPdf(
  html: string,
  outputFilePath: string,
  css: string,
  debugDumpHtml: boolean = false,
  baseDir?: string
): Promise<void> {
  const defaultArgs = ["--allow-file-access-from-files", "--enable-local-file-accesses"];

  // On many CI runners (including GitHub Actions) Chromium's sandbox is not
  // available. Passing these flags avoids the "No usable sandbox" failure.
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    defaultArgs.push("--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage");
  }

  const browser = await puppeteer.launch({
    args: defaultArgs,
  });
  const page = await browser.newPage();

  // @ts-expect-error CSS import fails here unfortunately
  const template = fs.readFileSync(templateFile, "utf-8");
  let finalHtml = template.replace("{{content}}", html).replace("{{css}}", css);

  // Determine a base URL for resolving relative resources (images, etc).
  if (baseDir) {
    // Use pathToFileURL to produce a correct file:/// URL on all platforms
    const baseUrl = pathToFileURL(path.resolve(baseDir) + path.sep).href;
    // Insert a <base> tag so relative URLs resolve against the markdown directory.
    finalHtml = finalHtml.replace(/<head>/i, `<head><base href="${baseUrl}">`);
  }

  // If debugDumpHtml is enabled, write the intermediate HTML next to the output PDF
  // AFTER any modifications (like inserting <base>) so the dumped HTML matches
  // what Puppeteer will actually render.
  if (debugDumpHtml) {
    try {
      const htmlPath = outputFilePath.replace(/\.pdf$/i, ".html");
      fs.writeFileSync(htmlPath, finalHtml, "utf-8");
    } catch (err) {
      console.warn("Warning: failed to write debug HTML:", err);
    }
  }

  // Use a slightly more permissive network idle and increase the timeout to
  // avoid flaky CI failures when external resources are slow or blocked.
  // Also set a default navigation timeout on the page so Puppeteer's internal
  // navigation watchers use the same timeout value.
  const navigationTimeout = 60000; // 60s
  const maybeSetDefaultNavTimeout = page as unknown as {
    setDefaultNavigationTimeout?: (t: number) => void;
  };
  maybeSetDefaultNavTimeout.setDefaultNavigationTimeout?.(navigationTimeout);

  try {
    await page.setContent(finalHtml, { waitUntil: "networkidle2", timeout: navigationTimeout });
  } catch (err) {
    // If setContent times out, warn and continue: in CI some external requests
    // (fonts, images) may hang or be blocked and we still want to produce a PDF.
    const msg = err instanceof Error ? err.message : String(err);
    if (/Navigation timeout|TimeoutError/i.test(msg)) {
      console.warn("Warning: page.setContent timed out - continuing without full network idle.");
    } else {
      throw err;
    }
  }

  await page.pdf({
    path: outputFilePath,
    format: "A4",
    printBackground: true,
  });

  await browser.close();
}

/**
 * Merges multiple PDFs into a single PDF.
 *
 * @param pdfSources
 * @returns
 */
export async function mergePdfs(pdfSources: PdfSource[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const source of pdfSources) {
    const pdfBytes = await fs.promises.readFile(source.path);
    const pdf = await PDFDocument.load(pdfBytes);

    let pageIndices = pdf.getPageIndices();

    // Apply page selection if options are provided
    if (source.pageOptions) {
      const { skip, include } = source.pageOptions;

      if (include && include.length > 0) {
        // If include is specified, only include those pages (1-indexed to 0-indexed)
        pageIndices = include
          .map((pageNum) => pageNum - 1)
          .filter((idx) => idx >= 0 && idx < pdf.getPageCount());
      } else if (skip && skip.length > 0) {
        // If skip is specified, exclude those pages (1-indexed to 0-indexed)
        const skipIndices = new Set(skip.map((pageNum) => pageNum - 1));
        pageIndices = pageIndices.filter((idx) => !skipIndices.has(idx));
      }
    }

    const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  return mergedPdf.save();
}
// Helper function to process chunks into PDF sources
export async function processChunksToPdfSources(
  chunks: Chunk[],
  inputPath: string,
  tmpDir: string,
  debugDumpHtml: boolean = false,
  themePath?: string
): Promise<PdfSource[]> {
  const pdfsToMerge: PdfSource[] = [];
  let tempPdfCounter = 0;

  let css: string;
  if (themePath) {
    css = fs.readFileSync(themePath, "utf-8");
  } else {
    css = fs.readFileSync(defaultCssFile, "utf-8");
  }

  for (const chunk of chunks) {
    if (chunk.type === "pdf") {
      const pdfPath = path.resolve(path.dirname(inputPath), chunk.path);
      try {
        await fs.promises.access(pdfPath, fs.constants.F_OK);
        pdfsToMerge.push({ path: pdfPath, pageOptions: chunk.pageOptions });
      } catch {
        console.warn(
          `Warning: PDF file not found: ${path.relative(process.cwd(), pdfPath)}. Skipping...`
        );
      }
    } else if (chunk.content.trim()) {
      const resolvedContent = resolveLinks(chunk.content, path.dirname(inputPath));
      const html = convertMarkdownToHtml(resolvedContent);
      const tempPdfPath = path.join(tmpDir, `temp_${tempPdfCounter++}.pdf`);
      await convertHtmlToPdf(html, tempPdfPath, css, debugDumpHtml, path.dirname(inputPath));
      pdfsToMerge.push({ path: tempPdfPath });
    }
  }

  return pdfsToMerge;
}
