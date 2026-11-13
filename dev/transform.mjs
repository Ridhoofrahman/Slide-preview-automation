// Turns the real app pages into test pages that run in a normal browser:
//  - panel.html:      PowerPoint (Office.js) and Supabase are replaced by dev/mock-panel.js
//  - review-app.html: Supabase is replaced by dev/mock-review.js
// The app files themselves are never modified. Run through dev/serve.mjs.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
const APP = path.join(ROOT, 'slide-qa-marker');

const STUB_CONFIG = '<script>window.SLIDE_REVIEW_CONFIG={SUPABASE_URL:"http://mock",SUPABASE_ANON_KEY:"mock",REVIEW_PAGE_URL:"/review",DAYS_TO_SHOW:21};</script>';
const SUPABASE_CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/[^"]*"><\/script>/;
const OFFICE_JS = /<script src="https:\/\/appsforoffice\.microsoft\.com\/[^"]*"><\/script>/;
const JSZIP = /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip\/[^"]*"><\/script>/;

function localScripts(html) {   // keep working relative script tags (e.g. slideshot-hero.js)
  return html.replace(/<script src="(?!https?:|\/)([^"]+\.js)"><\/script>/g, '<script src="/slide-qa-marker/$1"></script>');
}

export function panelPage() {
  let h = fs.readFileSync(path.join(APP, 'panel.html'), 'utf8');
  if (!OFFICE_JS.test(h) || !SUPABASE_CDN.test(h)) throw new Error('panel.html script tags changed: update dev/transform.mjs');
  h = h.replace(OFFICE_JS, '<script src="/dev/mock-panel.js"></script>')
       .replace(SUPABASE_CDN, '')
       .replace(JSZIP, '')                                   // slide-details needs a real .pptx export
       .replace('<script src="slide-details.js"></script>', '')
       .replace('<script src="config.js"></script>', STUB_CONFIG);
  return localScripts(h);
}

export function reviewPage() {
  let h = fs.readFileSync(path.join(APP, 'review-app.html'), 'utf8');
  if (!SUPABASE_CDN.test(h)) throw new Error('review-app.html script tags changed: update dev/transform.mjs');
  h = h.replace(SUPABASE_CDN, '<script src="/dev/mock-review.js"></script>')
       .replace('<script src="config.js"></script>', STUB_CONFIG);
  return localScripts(h);
}
