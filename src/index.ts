import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { convertMarkdownToHtml, resolveLinks } from './parser';
import { convertHtmlToPdf } from './pdf';
import { mergePdfs, PdfSource } from './merge-pdf';

// Ensure the tmp directory exists
const tmpDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

export async function convertMarkdownToPdf(inputPath: string, outputPath: string): Promise<void> {
  try {
    const markdown = fs.readFileSync(inputPath, 'utf-8');
    
    // Handle PDF embeds with optional page options
    const pdfLinkRegex = /\!\[([^\]]+)\]\(([^)]+\.pdf)\)(?:\{([^}]*)\})?/g;
    const chunks: ({ type: 'markdown'; content: string } | { type: 'pdf'; path: string; pageOptions?: { skip?: number[]; include?: number[] } })[] = [];
    let lastIndex = 0;
    let match;

    // Split the markdown into chunks of markdown and PDF links
    while ((match = pdfLinkRegex.exec(markdown)) !== null) {
      if (match.index > lastIndex) {
        chunks.push({ type: 'markdown', content: markdown.substring(lastIndex, match.index) });
      }

      const path = match[2];
      if (!path) continue; // Skip if path is not captured
      const optionsStr = match[3] || '';
      let pageOptions: { skip?: number[]; include?: number[] } | undefined;

      // Parse skip and include options if present
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

    const pdfsToMerge: PdfSource[] = [];
    let tempPdfCounter = 0;
    const tmpDir = path.join(process.cwd(), 'tmp');
    
    // Create tmp directory if it doesn't exist
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    for (const chunk of chunks) {
      if (chunk.type === 'pdf') {
        const pdfPath = path.resolve(path.dirname(inputPath), chunk.path);
        try {
          // Check if the file exists before adding it to the merge list
          await fs.promises.access(pdfPath, fs.constants.F_OK);
          pdfsToMerge.push({ path: pdfPath, pageOptions: chunk.pageOptions });
        } catch (error) {
          console.warn(`Warning: PDF file not found: ${path.relative(process.cwd(), pdfPath)}. Skipping...`);
        }
      } else if (chunk.content.trim()) {
        const resolvedContent = resolveLinks(chunk.content, path.dirname(inputPath));
        const html = convertMarkdownToHtml(resolvedContent);
        const tempPdfPath = path.join(tmpDir, `temp_${tempPdfCounter++}.pdf`);
        await convertHtmlToPdf(html, tempPdfPath);
        pdfsToMerge.push({ path: tempPdfPath });
      }
    }

    if (pdfsToMerge.length === 0) {
      throw new Error('No valid content or PDFs to process.');
    }

    const mergedPdfBytes = await mergePdfs(pdfsToMerge);
    fs.writeFileSync(outputPath, mergedPdfBytes);

    // Clean up temporary files
    for (const tempPdf of pdfsToMerge.filter(p => p.path.startsWith(tmpDir))) {
      try {
        fs.unlinkSync(tempPdf.path);
      } catch (error) {
        console.warn(`Warning: Could not delete temporary file ${tempPdf.path}`);
      }
    }

    console.log(`PDF successfully generated at ${outputPath}`);
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}

const program = new Command();

program
  .name('pdf-sticher')
  .description('Convert markdown files to PDF, resolving relative links and embedding PDFs')
  .version('1.0.0')
  .argument('<input>', 'Path to the markdown file')
  .argument('<output>', 'Path to the output PDF file')
  .action(async (input: string, output: string) => {
    try {
      await convertMarkdownToPdf(input, output);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
