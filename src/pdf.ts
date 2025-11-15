import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export async function convertHtmlToPdf(html: string, outputFilePath: string): Promise<void> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const templatePath = path.join(process.cwd(), 'templates', 'base.html');
  const cssPath = path.join(process.cwd(), 'templates', 'styles', 'default.css');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const css = fs.readFileSync(cssPath, 'utf-8');
  const finalHtml = template.replace('{{content}}', html).replace('{{css}}', css);

  // Debug: write the final HTML to a file
  fs.writeFileSync('debug.html', finalHtml);

  await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputFilePath,
    format: 'A4',
    printBackground: true,
  });

  await browser.close();
}
