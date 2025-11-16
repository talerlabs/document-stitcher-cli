import * as fs from "fs";
import * as path from "path";
import { createTempDirectory, cleanupTempFiles } from "./files";
import { PdfSource } from "../types";
import { expect, test, mock } from "bun:test";

mock.module("path");

const mockedFs = jest.mocked(fs);
const mockedPath = jest.mocked(path);

// Mock process.cwd
const mockCwd = "C:\\test\\project";
jest.spyOn(process, "cwd").mockReturnValue(mockCwd);

describe("createTempDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("create temp directory if it doesn't exist", () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockReturnValue(undefined);

    const result = createTempDirectory();

    expect(mockedPath.join).toHaveBeenCalledWith(mockCwd, "tmp");
    expect(mockedFs.existsSync).toHaveBeenCalledWith(path.join(mockCwd, "tmp"));
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.join(mockCwd, "tmp"), { recursive: true });
    expect(result).toBe(path.join(mockCwd, "tmp"));
  });

  test("return temp directory if it already exists", () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = createTempDirectory();

    expect(mockedFs.existsSync).toHaveBeenCalledWith(path.join(mockCwd, "tmp"));
    expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    expect(result).toBe(path.join(mockCwd, "tmp"));
  });
});

describe("cleanupTempFiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  test("delete temp files that start with tmpDir", () => {
    const tmpDir = path.join(mockCwd, "tmp");
    const pdfSources: PdfSource[] = [
      { path: path.join(tmpDir, "file1.pdf") },
      { path: path.join(tmpDir, "file2.pdf") },
      { path: "other/file.pdf" },
    ];

    mockedFs.unlinkSync.mockReturnValue(undefined);

    cleanupTempFiles(pdfSources, tmpDir);

    expect(mockedFs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(path.join(tmpDir, "file1.pdf"));
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(path.join(tmpDir, "file2.pdf"));
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test("warn on unlink error", () => {
    const tmpDir = path.join(mockCwd, "tmp");
    const pdfSources: PdfSource[] = [
      { path: path.join(tmpDir, "file1.pdf") },
    ];

    const unlinkError = new Error("Unlink failed");
    mockedFs.unlinkSync.mockImplementation(() => { throw unlinkError; });

    cleanupTempFiles(pdfSources, tmpDir);

    expect(consoleWarnSpy).toHaveBeenCalledWith(`Warning: Could not delete temporary file ${path.join(tmpDir, "file1.pdf")}, error: ${unlinkError}`);
  });

  test("not delete files outside tmpDir", () => {
    const tmpDir = path.join(mockCwd, "tmp");
    const pdfSources: PdfSource[] = [
      { path: "other/file.pdf" },
    ];

    cleanupTempFiles(pdfSources, tmpDir);

    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
  });
});
