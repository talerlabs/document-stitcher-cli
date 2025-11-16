import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import { Chunk, PdfSource } from "../types";
import { convertMarkdownToHtml, resolveLinks } from "./markdown";

/**
 * Converts HTML content to a PDF file.
 *
 * @param html
 * @param outputFilePath
 */
export async function convertHtmlToPdf(html: string, outputFilePath: string): Promise<void> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const templatePath = path.join(process.cwd(), "templates", "base.html");
  const cssPath = path.join(process.cwd(), "templates", "styles", "default.css");
  const template = fs.readFileSync(templatePath, "utf-8");
  const css = fs.readFileSync(cssPath, "utf-8");
  const finalHtml = template.replace("{{content}}", html).replace("{{css}}", css);

  await page.setContent(finalHtml, { waitUntil: "networkidle0" });

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
  tmpDir: string
): Promise<PdfSource[]> {
  const pdfsToMerge: PdfSource[] = [];
  let tempPdfCounter = 0;

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
      await convertHtmlToPdf(html, tempPdfPath);
      pdfsToMerge.push({ path: tempPdfPath });
    }
  }

  return pdfsToMerge;
}
