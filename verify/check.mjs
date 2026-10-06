// verify/check.mjs: test-only browser check, never shipped with the page.
// Usage: node verify/check.mjs [url] [label]   (default url: ../index.html)
// Loads the page at 390px in a fresh Chrome context, checks horizontal scroll,
// tabs to the download button, presses Enter, reads the .md file, lists third-party requests.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const target = process.argv[2] || new URL('../index.html', import.meta.url).href;
const label = process.argv[3] || 'local';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const requests = [];
page.on('request', r => requests.push(r.url()));
const response = await page.goto(target, { waitUntil: 'load' });
const origin = new URL(target).origin;
const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));

let reached = false;
for (let i = 0; i < 25 && !reached; i += 1) {
  await page.keyboard.press('Tab');
  reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'dl');
}
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.keyboard.press('Enter')]);
const md = readFileSync(await download.path(), 'utf8');
const thirdParty = requests.filter(u => !/^(data|blob):/.test(u) && new URL(u).origin !== origin);

const results = {
  target,
  status: response ? response.status() : null,
  viewport: '390x844',
  scrollWidth: layout.scrollWidth,
  clientWidth: layout.clientWidth,
  no_horizontal_scroll: layout.scrollWidth <= 390,
  download_button_reached_by_tab: reached,
  download_filename: download.suggestedFilename(),
  download_bytes: Buffer.byteLength(md),
  download_contains: {
    angles: (md.match(/^\d\. \[/gm) || []).length,
    proof_numbers: (md.match(/^\* /gm) || []).length,
    questions_heading: md.includes('## Three interview questions'),
    footer: md.includes('Not an official prommer.net page.'),
  },
  requests: requests.length,
  third_party_requests: thirdParty,
};
console.log(JSON.stringify(results, null, 2));
writeFileSync(new URL(`./results-${label}.json`, import.meta.url), JSON.stringify(results, null, 2) + '\n');
await browser.close();
if (!results.no_horizontal_scroll || thirdParty.length || !reached) process.exit(1);
