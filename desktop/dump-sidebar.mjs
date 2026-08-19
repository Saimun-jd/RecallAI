import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5174');
  
  await page.waitForSelector('nav');
  
  const button = await page.$('button[title="Collapse sidebar"]');
  if (button) {
    await button.click();
    await page.waitForTimeout(500);
  }

  const result = await page.evaluate(() => {
    const el = document.querySelector('.bg-surface-container-low.flex.flex-col');
    if (!el) return 'Not found';
    
    const rect = el.getBoundingClientRect();
    
    return {
      html: el.outerHTML,
      width: rect.width,
      cssWidth: window.getComputedStyle(el).width,
      inlineWidth: el.style.width,
      navWidth: document.querySelector('nav').getBoundingClientRect().width,
      navCssWidth: window.getComputedStyle(document.querySelector('nav')).width
    };
  });
  
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
