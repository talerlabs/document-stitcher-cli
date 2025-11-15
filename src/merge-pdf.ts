import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

export interface PdfSource {
  path: string;
  pageOptions?: {
    skip?: number[];
    include?: number[];
  };
}

export async function mergePdfs(pdfSources: PdfSource[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const source of pdfSources) {
    const pdfBytes = await fs.readFile(source.path);
    const pdf = await PDFDocument.load(pdfBytes);

    let pageIndices = pdf.getPageIndices();

    // Apply page selection if options are provided
    if (source.pageOptions) {
      const { skip, include } = source.pageOptions;

      if (include && include.length > 0) {
        // If include is specified, only include those pages (1-indexed to 0-indexed)
        pageIndices = include.map(pageNum => pageNum - 1).filter(idx => idx >= 0 && idx < pdf.getPageCount());
      } else if (skip && skip.length > 0) {
        // If skip is specified, exclude those pages (1-indexed to 0-indexed)
        const skipIndices = new Set(skip.map(pageNum => pageNum - 1));
        pageIndices = pageIndices.filter(idx => !skipIndices.has(idx));
      }
    }

    const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  return mergedPdf.save();
}
