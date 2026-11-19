import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();

// Desktop form
await page.setViewport({ width: 1280, height: 900 });
await page.goto('http://localhost:3778', { waitUntil: 'networkidle0', timeout: 30000 });
await page.screenshot({ path: '/tmp/uaqa-desktop-form.png' });

// Fill + submit
await page.type('#city', 'Delhi');
await page.click('button[type=submit]');
await page.waitForFunction(() => document.body.innerText.includes('Plan selected and ordered by'), { timeout: 60000 });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: '/tmp/uaqa-desktop-result.png', fullPage: true });

// Mobile
await page.setViewport({ width: 390, height: 844 });
await page.goto('http://localhost:3778', { waitUntil: 'networkidle0' });
await page.screenshot({ path: '/tmp/uaqa-mobile-form.png' });
await page.type('#city', 'Delhi');
await page.click('button[type=submit]');
await page.waitForFunction(() => document.body.innerText.includes('Plan selected and ordered by'), { timeout: 60000 });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: '/tmp/uaqa-mobile-result.png', fullPage: true });

await browser.close();
console.log('done');
