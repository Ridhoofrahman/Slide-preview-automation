# Slideshot

PowerPoint add-in (designers) + web dashboard (Design Managers) for reviewing slides at 24Slides.

- `slide-qa-marker/` the app, exactly as served by GitHub Pages
- `docs/slideshot-docs.html` user documentation (English / Bahasa Indonesia), generated from `docs/gen/`
- `dev/` test server with mock data, screenshot tool, syntax check
- `sql/` database scripts (the canonical one is `slide-qa-marker/supabase-setup.sql`)
- `design/FIGMA.md` Figma node map
- **`CLAUDE.md` read this first**: architecture, rules, conventions, open items

Start: `npm run dev`, then open http://localhost:5173/panel and http://localhost:5173/review.
Live dashboard: https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/review.html
