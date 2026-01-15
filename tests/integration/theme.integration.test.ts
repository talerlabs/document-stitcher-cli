import { spawnSync } from "child_process";
import { test, expect, describe } from "bun:test";
import * as path from "path";
import * as fs from "fs";

const ROOT = process.cwd();

describe("Theming Integration Test", () => {
  test("should apply custom CSS theme to generated PDF", () => {
    const inputPath = path.join(ROOT, "tests", "fixtures", "theme", "themed.md");
    const outputDir = path.join(ROOT, "test-output", "integration");

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, "themed-generated.pdf");
    const themePath = path.join(ROOT, "tests", "fixtures", "theme", "test_theme.scss");

    console.log(`Generating PDF with theme from ${themePath}...`);

    // Run the command
    // bun run src/index.ts input.md output.pdf --theme theme.css
    const result = spawnSync(
      "bun",
      ["run", "src/index.ts", inputPath, outputPath, "--theme", themePath],
      {
        cwd: ROOT,
        stdio: "inherit",
        encoding: "utf-8",
      }
    );

    // Check if command succeeded
    expect(result.status).toBe(0);

    // Check if output file exists
    expect(fs.existsSync(outputPath)).toBe(true);

    // Check file size checks to ensure content was written
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    console.log(`PDF successfully generated at ${outputPath}`);
  });
});
