import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { test, expect } from "bun:test";

const ROOT = process.cwd();

function getPlatformScriptAndBinary(): { script: string; binary: string } {
  const platform = process.platform;
  if (platform === "win32") {
    return { script: "package:win", binary: path.join(ROOT, "bin", "pdf-sticher.exe") };
  }
  if (platform === "darwin") {
    return { script: "package:mac", binary: path.join(ROOT, "bin", "pdf-sticher") };
  }
  return { script: "package:linux", binary: path.join(ROOT, "bin", "pdf-sticher") };
}

test("build binary and generate PDFs from generated markdowns", async () => {
  const { script, binary } = getPlatformScriptAndBinary();

  // Clean output dir
  const outputDir = path.join(ROOT, "test-output", "integration");
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch (_) {}
  fs.mkdirSync(outputDir, { recursive: true });

  // Build the binary using bun script
  console.log(`Running build script: bun run ${script}`);
  const build = spawnSync("bun", ["run", script], { stdio: "inherit", shell: true, timeout: 20 * 60 * 1000 });
  if (build.error) {
    throw build.error;
  }
  if (build.status !== 0) {
    throw new Error(`Build failed with exit code ${build.status}`);
  }

  if (!fs.existsSync(binary)) {
    throw new Error(`Binary not found at ${binary}`);
  }

  // Find generated markdowns (moved into the fixtures markdown folder)
  const inputDir = path.join(ROOT, "tests", "fixtures", "markdown");
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input fixtures directory not found: ${inputDir}`);
  }

  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    throw new Error(`No markdown fixtures found in ${inputDir}`);
  }

  for (const f of files) {
    const inputPath = path.join(inputDir, f);
    const outName = `${path.basename(f).replace(/\.md$/, "")}-generated.pdf`;
    const outputPath = path.join(outputDir, outName);

    console.log(`Generating PDF for ${inputPath} -> ${outputPath}`);
    const run = spawnSync(binary, [inputPath, outputPath], { stdio: "inherit", shell: true, timeout: 2 * 60 * 1000 });

    if (run.error) {
      throw run.error;
    }
    if (run.status !== 0) {
      throw new Error(`Binary exited with code ${run.status} for input ${f}`);
    }

    expect(fs.existsSync(outputPath)).toBe(true);
  }
}, { timeout: 30 * 60 * 1000 });
