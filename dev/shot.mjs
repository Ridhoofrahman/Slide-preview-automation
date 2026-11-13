// Screenshot a test page:  node dev/shot.mjs "/panel?n=1&st=waiting" out.png [--w 320] [--h 694] [--scale 2] [--wait 1500]
// Needs Playwright once:   npm install && npx playwright install chromium
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? Number(args[i + 1]) : dflt; };
const [route, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!route || !out) { console.error('usage: node dev/shot.mjs "/panel?n=1" out.png [--w 320 --h 694 --scale 2 --wait 1500]'); process.exit(1); }

const port = 5290 + Math.floor(Math.random() * 400);
const server = await startServer(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: flag('w', 1280), height: flag('h', 800) }, deviceScaleFactor: flag('scale', 2) });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${port}${route}`);
await page.waitForTimeout(flag('wait', 1500));
await page.screenshot({ path: out });
await browser.close(); server.close();
console.log('saved', out, errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : '(no page errors)');
