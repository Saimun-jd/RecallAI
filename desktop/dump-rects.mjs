import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set up logging to catch any errors
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  console.log("Navigating...");
  await page.goto('http://localhost:5173/books/13', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Dumping rects...");
  const rects = await page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('.page'));
    return pages.map(p => ({
      page: p.getAttribute('data-page-number'),
      rect: p.getBoundingClientRect().toJSON(),
      offsetParent: p.offsetParent ? p.offsetParent.className : null,
      offsetTop: p.offsetTop
    }));
  });
  
  console.log("Rects:", JSON.stringify(rects, null, 2));
  
  const highlighterStyle = await page.evaluate(() => {
    const hl = document.querySelector('.PdfHighlighter');
    if (!hl) return null;
    return {
      rect: hl.getBoundingClientRect().toJSON(),
      scrollHeight: hl.scrollHeight,
      clientHeight: hl.clientHeight,
      overflow: window.getComputedStyle(hl).overflow
    };
  });
  
  console.log("Highlighter:", highlighterStyle);
  
  await browser.close();
})();
