export interface PdfSource {
  path: string;
  pageOptions?: {
    skip?: number[];
    include?: number[];
  };
}
