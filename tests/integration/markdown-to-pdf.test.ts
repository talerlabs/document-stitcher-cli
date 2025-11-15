import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
const { PDFParse } = require('pdf-parse');

describe('Markdown to PDF CLI Integration Tests', () => {
  const testDir = path.join(__dirname, '..', '..', 'test-output');
  const cliPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test output directory (keep complex output for debugging if test fails)
    if (fs.existsSync(testDir)) {
      const complexPdf = path.join(testDir, 'complex-output.pdf');
      if (fs.existsSync(complexPdf)) {
        console.log('Keeping complex-output.pdf for debugging');
      } else {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    }
  });

  test('should resolve relative links in markdown', () => {
    const inputMd = path.join(testDir, 'test-links.md');
    const outputPdf = path.join(testDir, 'links-output.pdf');

    // Create test markdown with relative links
    const testContent = `
# Test Document

This document has a [relative link](./test.md) that should be resolved.

Also an [absolute link](https://example.com) that should remain unchanged.
`;

    fs.writeFileSync(inputMd, testContent);

    // Run the CLI
    execSync(`node "${cliPath}" "${inputMd}" "${outputPdf}"`, { stdio: 'inherit' });

    // Verify PDF was created and has content
    expect(fs.existsSync(outputPdf)).toBe(true);
    const stats = fs.statSync(outputPdf);
    expect(stats.size).toBeGreaterThan(1000); // PDF should be at least 1KB
  });

  test('should embed PDFs when referenced', () => {
    const inputMd = path.join(testDir, 'test-embed.md');
    const outputPdf = path.join(testDir, 'embed-output.pdf');

    // Create test markdown with PDF reference
    const testContent = `
# Test Document

This document embeds a PDF:

[Embedded PDF](./dummy.pdf)

End of document.
`;

    fs.writeFileSync(inputMd, testContent);

    // Run the CLI
    execSync(`node "${cliPath}" "${inputMd}" "${outputPdf}"`, { stdio: 'inherit' });

    // Verify PDF was created and has content
    expect(fs.existsSync(outputPdf)).toBe(true);
    const stats = fs.statSync(outputPdf);
    expect(stats.size).toBeGreaterThan(1000); // PDF should be at least 1KB
  });

  test('should handle empty markdown file', () => {
    const inputMd = path.join(testDir, 'empty.md');
    const outputPdf = path.join(testDir, 'empty-output.pdf');

    // Create empty markdown file
    fs.writeFileSync(inputMd, '');

    // Run the CLI - this should fail gracefully
    expect(() => {
      execSync(`node "${cliPath}" "${inputMd}" "${outputPdf}"`, { stdio: 'inherit' });
    }).toThrow();
  });

  test('should handle non-existent input file', () => {
    const inputMd = path.join(testDir, 'nonexistent.md');
    const outputPdf = path.join(testDir, 'error-output.pdf');

    // Run the CLI - this should fail
    expect(() => {
      execSync(`node "${cliPath}" "${inputMd}" "${outputPdf}"`, { stdio: 'inherit' });
    }).toThrow();
  });

  test('should generate PDF with complex content including page breaks, tables, and long text', async () => {
    const inputMd = path.join(testDir, 'complex-content.md');
    const outputPdf = path.join(testDir, 'complex-output.pdf');

    // Create comprehensive test markdown with all features
    const testContent = `
# Complex Test Document

This document tests all features of the PDF generator.

## Page Breaks

This text is on the first page.

---

This text should appear on a new page after the horizontal rule.

## Tables

| Feature | Status | Description |
|---------|--------|-------------|
| Page Breaks | ✅ | Horizontal rules create page breaks |
| Images | ✅ | Images are embedded in PDF |
| Tables | ✅ | Tables are rendered properly |
| Long Text | ✅ | Text wraps across pages |
| PDF Stitching | ✅ | Multiple PDFs can be combined |

## Long Text Content

${'This is a very long paragraph that should demonstrate text wrapping and pagination. '.repeat(50)}

### More Content

${'Additional content to ensure multiple pages. '.repeat(25)}

## Images

![Test Image](https://placekitten.com/400/300)

## Mathematical Content

Inline math: $E = mc^2$

Display math:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Code Blocks

\`\`\`javascript
function complexFunction() {
  console.log('This is a complex function with multiple lines');
  console.log('It should be properly formatted in the PDF');
  return 'success';
}
\`\`\`

## Lists

### Unordered List
- Item 1
- Item 2
  - Nested item
  - Another nested item
- Item 3

### Ordered List
1. First step
2. Second step
3. Third step

---

## Final Page

This content appears on the final page to test multi-page documents.

[Embedded PDF](./dummy.pdf)
`;

    fs.writeFileSync(inputMd, testContent);

    // Run the CLI
    execSync(`node "${cliPath}" "${inputMd}" "${outputPdf}"`, { stdio: 'inherit' });

    // Verify PDF was created
    expect(fs.existsSync(outputPdf)).toBe(true);

    // Use external script to verify PDF content (avoids Jest ESM issues)
    const verifyScript = path.join(__dirname, '..', 'verify-pdf.js');
    const result = execSync(`node "${verifyScript}" "${outputPdf}"`, { encoding: 'utf8' });
    const verification = JSON.parse(result);

    // Verify the verification was successful
    expect(verification.success).toBe(true);

    // Verify PDF text content includes all expected elements (page breaks, images, tables, etc.)
    expect(verification.hasTitle).toBe(true);
    expect(verification.hasPageBreaks).toBe(true);
    expect(verification.hasTables).toBe(true);
    expect(verification.hasLongText).toBe(true);
    expect(verification.hasImages).toBe(true);
    expect(verification.hasMath).toBe(true);
    expect(verification.hasCode).toBe(true);
    expect(verification.hasLists).toBe(true);
    expect(verification.hasFinalPage).toBe(true);

    // Verify substantial content (long text should be present)
    expect(verification.hasSubstantialContent).toBe(true);
    expect(verification.textLength).toBeGreaterThan(2000);

    // Verify that the PDF contains the expected table data
    expect(verification.text).toContain('Page Breaks');
    expect(verification.text).toContain('Images');
    expect(verification.text).toContain('Tables');
    expect(verification.text).toContain('Long Text');
  });
});
