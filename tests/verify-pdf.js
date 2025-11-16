const fs = require("fs");
const { PDFParse } = require("pdf-parse");

async function verifyPdfContent(pdfPath) {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();

    const text = result.text;
    const numpages = result.numpages;

    // Check for expected content
    const hasTitle = text.includes("Complex Test Document");
    const hasPageBreaks = text.includes("Page Breaks");
    const hasTables = text.includes("Tables");
    const hasLongText = text.includes("Long Text Content");
    const hasImages = text.includes("Images");
    const hasMath = text.includes("Mathematical Content");
    const hasCode = text.includes("Code Blocks");
    const hasLists = text.includes("Lists");
    const hasFinalPage = text.includes("Final Page");
    const hasMultiplePages = numpages > 1;
    const hasSubstantialContent = text.length > 2000;

    return {
      success: true,
      numpages,
      textLength: text.length,
      hasTitle,
      hasPageBreaks,
      hasTables,
      hasLongText,
      hasImages,
      hasMath,
      hasCode,
      hasLists,
      hasFinalPage,
      hasMultiplePages,
      hasSubstantialContent,
      text: text.substring(0, 500), // Include first 500 chars for debugging
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// If called directly, verify the PDF passed as argument
if (require.main === module) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node verify-pdf.js <pdf-path>");
    process.exit(1);
  }

  verifyPdfContent(pdfPath)
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    });
}

module.exports = { verifyPdfContent };
