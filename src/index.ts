import { Command } from "commander";
import { mergePdfs, processChunksToPdfSources } from "./utils/pdf";
import * as fs from "fs";
import { parseMarkdownIntoChunks } from "./utils/markdown";
import { cleanupTempFiles, createTempDirectory } from "./utils/files";

export async function convertMarkdownToPdf(
  inputPath: string,
  outputPath: string,
  debugHtml: boolean = false
): Promise<void> {
  try {
    const markdown = fs.readFileSync(inputPath, "utf-8");
    const tempDir = createTempDirectory();

    // Parse markdown into chunks
    const chunks = parseMarkdownIntoChunks(markdown);

    // Process chunks into PDF sources (pass debugHtml to emit intermediate HTML files)
    const pdfsToMerge = await processChunksToPdfSources(chunks, inputPath, tempDir, debugHtml);

    if (pdfsToMerge.length === 0) {
      throw new Error("No valid content or PDFs to process.");
    }

    // Merge PDFs
    const mergedPdfBytes = await mergePdfs(pdfsToMerge);

    // Write output PDF
    fs.writeFileSync(outputPath, mergedPdfBytes);

    // Clean up temporary files
    cleanupTempFiles(pdfsToMerge, tempDir);

    console.log(`PDF successfully generated at ${outputPath}`);
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}

const program = new Command();

program
  .name("document-stitcher")
  .description("Convert markdown files to PDF, resolving relative links and embedding PDFs")
  .version("1.0.0")
  .option("--debug-html", "Write intermediate HTML files next to generated PDFs")
  .argument("<input>", "Path to the markdown file")
  .argument(
    "[output]",
    "Path to the output PDF file (optional, defaults to <markdown-name>-generated.pdf)"
  )
  .action(async (input: string, output?: string, options?: { debugHtml?: boolean }) => {
    try {
      // If output is not provided, generate default path
      if (!output) {
        const inputDir = input.substring(0, input.lastIndexOf("/") + 1 || 0);
        const inputBasename = input.substring(input.lastIndexOf("/") + 1).replace(/\.md$/, "");
        output = `${inputDir}${inputBasename}-generated.pdf`;
      }
      const debugHtml = !!(options && options.debugHtml);
      await convertMarkdownToPdf(input, output, debugHtml);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse();
