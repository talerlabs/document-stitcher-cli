import * as fs from "fs";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import puppeteer, { Browser } from "puppeteer";
import { Chunk } from "../types";
import * as pdf from "./pdf";
import { mock, spyOn, expect, describe, test, afterEach, it, Mock } from "bun:test";

// Mock the external dependencies
mock.module("puppeteer", () => ({
  default: {
    launch: mock(),
  },
}));
mock.module("pdf-lib", () => ({
  PDFDocument: {
    create: mock(),
    load: mock(),
  },
}));

mock.module("fs", () => ({
  ...require("fs"),
  promises: {
    ...require("fs").promises,
    readFile: mock(),
    access: mock(),
  },
  readFileSync: mock(),
}));

describe("pdf utils", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("convertHtmlToPdf", () => {
    it("should convert HTML to PDF", async () => {
      const mockPage = {
        setContent: mock(),
        pdf: mock(),
      };
      const mockBrowser = {
        newPage: mock().mockResolvedValue(mockPage),
        close: mock(),
      };
      (puppeteer.launch as Mock<typeof puppeteer.launch>).mockResolvedValue(
        mockBrowser as unknown as Browser
      );
      const readFileMock = fs.readFileSync as Mock<typeof fs.readFileSync>;
      readFileMock.mockReturnValueOnce(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono&display=swap"
      rel="stylesheet"
    />
    <style>
      {{css}}
    </style>
  </head>
  <body>
    <div class="markdown-body">{{content}}</div>

    <!-- MathJax for rendering mathematical expressions -->
    <script>
      // Load MathJax if it's not already loaded
      if (typeof MathJax === "undefined") {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
        script.async = true;
        script.integrity = "sha384-0s9vVw2h0v9JQ+J0J8J4h0h6P5v1Y+Qp6o0f4Pp9g8JlEhBL+5U+5OJ4Ue1LkF";
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
    </script>
  </body>
</html>`);
      readFileMock.mockReturnValueOnce("body { color: red; }");

      const html = "<p>Hello</p>";
      const outputFilePath = "/path/to/output.pdf";

      await pdf.convertHtmlToPdf(html, outputFilePath);

      expect(puppeteer.launch).toHaveBeenCalled();
      expect(mockBrowser.newPage).toHaveBeenCalled();
      const expectedHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono&display=swap"
      rel="stylesheet"
    />
    <style>
      body { color: red; }
    </style>
  </head>
  <body>
    <div class="markdown-body"><p>Hello</p></div>

    <!-- MathJax for rendering mathematical expressions -->
    <script>
      // Load MathJax if it's not already loaded
      if (typeof MathJax === "undefined") {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
        script.async = true;
        script.integrity = "sha384-0s9vVw2h0v9JQ+J0J8J4h0h6P5v1Y+Qp6o0f4Pp9g8JlEhBL+5U+5OJ4Ue1LkF";
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
    </script>
  </body>
</html>`;
      expect(mockPage.setContent).toHaveBeenCalledWith(expectedHtml, {
        waitUntil: "networkidle0",
      });
      expect(mockPage.pdf).toHaveBeenCalledWith({
        path: outputFilePath,
        format: "A4",
        printBackground: true,
      });
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
  describe("mergePdfs", () => {
    it("should merge multiple PDFs", async () => {
      const mockPdfDoc = {
        copyPages: mock().mockResolvedValue([{}, {}]),
        addPage: mock(),
        save: mock().mockResolvedValue(new Uint8Array()),
        getPageIndices: mock().mockReturnValue([0, 1]),
        getPageCount: mock().mockReturnValue(2),
      };
      (PDFDocument.create as Mock<typeof PDFDocument.create>).mockResolvedValue(
        mockPdfDoc as unknown as PDFDocument
      );
      (PDFDocument.load as Mock<typeof PDFDocument.load>).mockResolvedValue(
        mockPdfDoc as unknown as PDFDocument
      );
      (fs.promises.readFile as Mock<typeof fs.promises.readFile>).mockResolvedValue(
        Buffer.from("data")
      );

      const pdfSources = [{ path: "/path/to/1.pdf" }, { path: "/path/to/2.pdf" }];
      await pdf.mergePdfs(pdfSources);

      expect(PDFDocument.create).toHaveBeenCalled();
      expect(fs.promises.readFile).toHaveBeenCalledTimes(2);
      expect(PDFDocument.load).toHaveBeenCalledTimes(2);
      expect(mockPdfDoc.copyPages).toHaveBeenCalledTimes(2);
      expect(mockPdfDoc.addPage).toHaveBeenCalledTimes(4);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it("should handle page selections", async () => {
      const mockPdfDoc = {
        copyPages: mock().mockResolvedValue([{}, {}]),
        addPage: mock(),
        save: mock().mockResolvedValue(new Uint8Array()),
        getPageIndices: mock().mockReturnValue([0, 1, 2, 3]),
        getPageCount: mock().mockReturnValue(4),
      };
      (PDFDocument.create as Mock<typeof PDFDocument.create>).mockResolvedValue(
        mockPdfDoc as unknown as PDFDocument
      );
      (PDFDocument.load as Mock<typeof PDFDocument.load>).mockResolvedValue(
        mockPdfDoc as unknown as PDFDocument
      );
      (fs.promises.readFile as Mock<typeof fs.promises.readFile>).mockResolvedValue(
        Buffer.from("data")
      );

      const pdfSources = [
        {
          path: "/path/to/1.pdf",
          pageOptions: { include: [1, 3] },
        },
        {
          path: "/path/to/2.pdf",
          pageOptions: { skip: [2] },
        },
      ];
      await pdf.mergePdfs(pdfSources);

      expect(mockPdfDoc.copyPages).toHaveBeenCalledWith(mockPdfDoc, [0, 2]);
      expect(mockPdfDoc.copyPages).toHaveBeenCalledWith(mockPdfDoc, [0, 2, 3]);
    });
  });

  describe("processChunksToPdfSources", () => {
    test("should process chunks and return PDF sources", async () => {
      (fs.promises.access as Mock<typeof fs.promises.access>).mockResolvedValue();
      const chunks: Chunk[] = [
        { type: "pdf", path: "1.pdf", pageOptions: { include: [1] } },
        { type: "markdown", content: "## Hello" },
      ];
      const inputPath = "/path/to/input.md";
      const tmpDir = "/tmp";

      const convertHtmlToPdfSpy = spyOn(pdf, "convertHtmlToPdf").mockResolvedValue(undefined);
      await pdf.processChunksToPdfSources(chunks, inputPath, tmpDir);

      expect(convertHtmlToPdfSpy).toHaveBeenCalled();
    });

    test("should warn when a PDF file is not found", async () => {
      (fs.promises.access as Mock<typeof fs.promises.access>).mockRejectedValue(
        new Error("File not found")
      );
      const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});

      const chunks: Chunk[] = [{ type: "pdf", path: "nonexistent.pdf" }];
      const inputPath = "/path/to/input.md";
      const tmpDir = "/tmp";

      const sources = await pdf.processChunksToPdfSources(chunks, inputPath, tmpDir);

      expect(sources).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Warning: PDF file not found: ${path.relative(
          process.cwd(),
          path.resolve(path.dirname(inputPath), "nonexistent.pdf")
        )}. Skipping...`
      );
    });
  });
});
