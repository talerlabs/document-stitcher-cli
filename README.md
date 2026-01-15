# Document Stitcher

Stitch together Markdown, images, and PDFs into a single printable PDF suitable for submissions, reports, and archives. Write content using familiar Markdown syntax and the tool will render the document, embed external PDFs, inline images when possible, and produce a final PDF ready for distribution.

Author documents in any text editor or generate content with an LLM — the workflow stays the same: write Markdown, reference assets, and let the tool assemble the final PDF.

## Markdown Features

### Math Expressions

Use LaTeX-style math expressions that will be rendered using MathJax:

```markdown
Inline math: $E = mc^2$

Display math:
$$\int_{-\infty}^\infty e^{-x^2} dx = \sqrt{\pi}$$
```

### Images

Include images with custom sizes:

```markdown
![Alt text](path/to/image.jpg =250x150)
```

### Page Breaks

Insert page breaks using:

```markdown
\pagebreak
```

### PDF Embedding

Embed PDFs that will be included in the final output:

```markdown
![PDF Document](path/to/document.pdf)
```

### Skipping or Selecting Pages

You can control which pages from an embedded PDF are included using simple operators in the image alt text. Page numbers are 1-indexed.

- Skip pages: use `!=` followed by a comma-separated list of page numbers to exclude those pages. Example:

```markdown
![PDF Document !=1,2](path/to/document.pdf)
```

- Include pages: use `=` followed by a comma-separated list of page numbers to include only those pages. Example:

```markdown
![PDF Document =3,4](path/to/document.pdf)
```

You cannot specify both `!=` and `=` for the same PDF (the tool will throw an error).

## Theming

Customize the appearance of your generated PDFs by providing a custom CSS file:

```bash
document-stitcher input.md output.pdf --theme custom-theme.css
```

The CSS file will be applied to the HTML before PDF generation, giving you full control over fonts, colors, spacing, and layout. See [test_theme.scss](tests/fixtures/theme/test_theme.scss) for an example of a colorful theme.

## Examples

Here are some example PDFs generated from the test fixtures:

- [Basic Markdown](test-output/integration/basic-generated.pdf) - Simple markdown rendering
- [Combined Features](test-output/integration/combined-generated.pdf) - Multiple markdown features
- [Embedded PDFs](test-output/integration/embed-pdf-generated.pdf) - PDF embedding functionality
- [Images](test-output/integration/images-generated.pdf) - Image inclusion and sizing
- [Math Expressions](test-output/integration/math-generated.pdf) - LaTeX math rendering
- [Multi-page PDFs](test-output/integration/multi_page_full-generated.pdf) - Full PDF embedding
- [Page Selection](test-output/integration/multi_page_include-generated.pdf) - Selective page inclusion
- [Page Skipping](test-output/integration/multi_page_skip-generated.pdf) - Page exclusion
- [Page Breaks](test-output/integration/pagebreaks-generated.pdf) - Manual page breaks
- [Custom Theme](test-output/integration/themed-generated.pdf) - Colorful themed output

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
