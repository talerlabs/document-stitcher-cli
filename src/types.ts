export interface ConversionOptions {
  markdownFilePath: string;
  outputFilePath: string;
  cssFilePath?: string;
  theme?: string;
}

export interface PdfSource {
  path: string;
  pageOptions?: {
    skip?: number[];
    include?: number[];
  };
}

// Types for markdown chunks
export type MarkdownChunk = { type: "markdown"; content: string };
export type PdfChunk = {
  type: "pdf";
  path: string;
  pageOptions?: { skip?: number[]; include?: number[] };
};
export type Chunk = MarkdownChunk | PdfChunk;
