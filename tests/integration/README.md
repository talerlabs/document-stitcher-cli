# Integration Tests — Setup

Place the local assets used by the generated markdown fixtures into `tests/integration/assets/`.

Expected asset names (examples):

- `embeddable.pdf` — a small PDF to be embedded by `embed-pdf.md` and `combined.md`.
- `logo.png` — an image used by `images.md` and `combined.md`.

How to run the single integration test locally:

1. Ensure `bun` is installed and available on PATH.
2. From the repository root run:

```powershell
bun test tests/integration/binary.integration.test.ts
```

Notes:
- The test builds a platform binary using the `package:win|mac|linux` script defined in `package.json`.
- The test writes generated PDFs to `test-output/integration/`.
- The test is intentionally conservative: if assets are missing the generator may warn but the test will still attempt PDF generation and only fail if the binary is missing or the generator exits with an error.
