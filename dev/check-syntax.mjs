// Fast syntax check of the inline <script> in the app pages and of the plain .js files.  node dev/check-syntax.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './transform.mjs';

const APP = path.join(ROOT, 'slide-qa-marker');
let bad = 0;
const check = (name, code) => { try { new vm.Script(code, { filename: name }); console.log('ok   ', name); } catch (e) { bad++; console.log('FAIL ', name, '-', e.message); } };
for (const f of ['panel.html', 'review-app.html', 'taskpane.html', 'review.html', 'commands.html']) {
  const html = fs.readFileSync(path.join(APP, f), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  blocks.forEach((b, i) => check(`${f} (inline script ${i + 1})`, b));
}
for (const f of ['slide-details.js', 'slideshot-hero.js', 'config.js']) check(f, fs.readFileSync(path.join(APP, f), 'utf8'));
process.exit(bad ? 1 : 0);
