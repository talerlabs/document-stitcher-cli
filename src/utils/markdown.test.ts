import { describe, test, expect } from "bun:test";
import * as path from "path";
import { resolveLinks, convertMarkdownToHtml, parseMarkdownIntoChunks } from "./markdown";

describe("markdown", () => {
  describe("resolveLinks", () => {
    const baseDir = "/test/dir";

    test("should resolve relative pdf links to absolute file URLs", () => {
      const markdown = "![link](./test.pdf)";
      const result = resolveLinks(markdown, baseDir);
      const expectedPath = path.resolve(baseDir, "./test.pdf");
      const expectedUrl = require("url").pathToFileURL(expectedPath).href;
      expect(result).toBe(`![link](${expectedUrl})`);
    });

    test("should not change absolute links", () => {
      const markdown = "[link](http://example.com)";
      const result = resolveLinks(markdown, baseDir);
      expect(result).toBe(markdown);
    });

    test("should not change file:// links", () => {
      const markdown = "[link](file:///test.md)";
      const result = resolveLinks(markdown, baseDir);
      expect(result).toBe(markdown);
    });

    test("should not change root path links", () => {
      const markdown = "[link](/test.md)";
      const result = resolveLinks(markdown, baseDir);
      expect(result).toBe(markdown);
    });
  });

  describe("convertMarkdownToHtml", () => {
    test("should convert markdown to html", () => {
      const markdown = "# Hello";
      const result = convertMarkdownToHtml(markdown);
      expect(result).toBe("<h1>Hello</h1>\n");
    });

    test("should apply page breaks before converting to html", () => {
      const markdown = "# Hello\\pagebreak## World";
      const result = convertMarkdownToHtml(markdown);
      expect(result).toContain('<div style="page-break-after: always;"></div>');
    });

    test("should support attribute list syntax (markdown-it-attrs)", () => {
      const markdown = "### Hello {#greet .big}";
      const result = convertMarkdownToHtml(markdown);
      expect(result).toContain('<h3 id="greet" class="big">Hello</h3>');
    });
  });

  describe("parseMarkdownIntoChunks", () => {
    test("should parse markdown into chunks", () => {
      const markdown = "some markdown text ![pdf](./test.pdf) more markdown";
      const result = parseMarkdownIntoChunks(markdown);
      expect(result).toEqual([
        { type: "markdown", content: "some markdown text " },
        { type: "pdf", path: "./test.pdf", pageOptions: {} },
        { type: "markdown", content: " more markdown" },
      ]);
    });

    test("should handle multiple pdf links", () => {
      const markdown = "![pdf1](./1.pdf)![pdf2](./2.pdf)";
      const result = parseMarkdownIntoChunks(markdown);
      expect(result).toEqual([
        { type: "pdf", path: "./1.pdf", pageOptions: {} },
        { type: "pdf", path: "./2.pdf", pageOptions: {} },
      ]);
    });

    test("should handle pdf links with skip options", () => {
      const markdown = "![pdf !=1,2](./test.pdf)";
      const result = parseMarkdownIntoChunks(markdown);
      expect(result).toEqual([{ type: "pdf", path: "./test.pdf", pageOptions: { skip: [1, 2] } }]);
    });

    test("should handle pdf links with include options", () => {
      const markdown = "![pdf =3,4](./test.pdf)";
      const result = parseMarkdownIntoChunks(markdown);
      expect(result).toEqual([
        { type: "pdf", path: "./test.pdf", pageOptions: { include: [3, 4] } },
      ]);
    });

    test("should throw error if both skip and include are provided", () => {
      // Provide both operators in the alt text to simulate a conflicting spec
      const markdown = "![pdf !=1 =2](./test.pdf)";
      expect(() => parseMarkdownIntoChunks(markdown)).toThrow();
    });

    test("should handle markdown at the beginning and end", () => {
      const markdown = "start ![pdf](./test.pdf) end";
      const result = parseMarkdownIntoChunks(markdown);
      expect(result).toEqual([
        { type: "markdown", content: "start " },
        { type: "pdf", path: "./test.pdf", pageOptions: {} },
        { type: "markdown", content: " end" },
      ]);
    });

    test("should handle no pdf links", () => {
      const markdown = "just some markdown";
      const result = parseMarkdownIntoChunks(markdown);
      expect(result).toEqual([{ type: "markdown", content: "just some markdown" }]);
    });
  });
});
