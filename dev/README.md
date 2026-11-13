# dev/: run and test without PowerPoint or Supabase

```bash
npm run dev          # http://localhost:5173
```
| URL | Runs |
|---|---|
| `/panel?n=1&st=notsent` | the real `panel.html` with fake PowerPoint + Supabase (`mock-panel.js`) |
| `/panel?n=1&st=notsent&dm=1` | same, signed in as a DM (footer shows **Dashboard**) |
| `/review` | the real `review-app.html` with fake data (`mock-review.js`) |

`/panel` options: `n` = selected slide 1–10 · `st` = `notsent`, `waiting`, `update`, `seed` (slides 8 and 9 already sent) · `dm=1`. Switch slide in the page with `window.__sel = 8; refreshDeck()`.

`transform.mjs` swaps the real script tags for the mocks on the fly, so **the app files are never edited** and a browser refresh always shows your latest changes. If you change the `<script src=…>` lines at the top of `panel.html` or `review-app.html`, it will tell you to update `transform.mjs`.

Screenshots: `npm install && npx playwright install chromium`, then
`npm run shot -- "/panel?n=1" out.png --w 320 --h 694` (add `--scale`, `--wait`).

Not covered: real Office.js, `slide-details.js` (needs a real .pptx), Supabase RLS.
