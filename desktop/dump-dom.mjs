import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/books/13', { waitUntil: 'networkidle0' });
  
  // Try to bypass auth if possible, or wait to see if we can get anything
  await new Promise(r => setTimeout(r, 3000));
  
  try {
    const html = await page.evaluate(() => {
      const container = document.querySelector('.pdfViewer');
      return container ? container.outerHTML.substring(0, 5000) : 'NO_PDF_VIEWER';
    });
    fs.writeFileSync('dom-dump.txt', html);
    console.log("DOM dumped!");
  } catch(e) {
    console.log("Error:", e.message);
  }

  await browser.close();
})();
