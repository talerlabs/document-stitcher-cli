import * as fs from 'fs';
import * as path from 'path';
import { PdfSource } from "../types/PDFSource";

/**
 * Ensures that a temporary directory exists and returns its path.
 * @returns 
 */
export function createTempDirectory(): string {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
}

/**
 * Cleans up temporary PDF files created during the conversion process.
 * 
 * @param pdfSources 
 * @param tmpDir 
 */
export function cleanupTempFiles(pdfSources: PdfSource[], tmpDir: string): void {
    for (const tempPdf of pdfSources.filter(p => p.path.startsWith(tmpDir))) {
        try {
            fs.unlinkSync(tempPdf.path);
        } catch (error) {
            console.warn(`Warning: Could not delete temporary file ${tempPdf.path}`);
        }
    }
}