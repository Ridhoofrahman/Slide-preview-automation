# Slideshot: project guide for Claude Code

Slideshot is an internal tool at 24Slides. Designers send finished PowerPoint slides for review from an **add-in side panel**; Design Managers (DMs) distribute work, review every slide and track each order on a **web dashboard**. There is no dev team: Uda (senior product designer) builds it with Claude. You write the code, read/edit Figma through the Figma MCP, and she reviews by Figma frames and screenshots.

## How to work with Uda
- She writes mostly **Indonesian**, sometimes English. Answer in the language she writes in. **All product UI copy stays English.**
- **Apply Figma designs exactly.** Read the node, measure it, then match px, colors, radius and spacing. Export icons from Figma as SVG; never hand-draw icons. After building, measure DOM positions against the Figma numbers and look at a screenshot. Fonts render ~1px wider in Chrome than in Figma, so give wrapping text 1–2px slack to keep Figma's line breaks.
- If the design conflicts with how something works (e.g. a hover button covering a tag), do not silently pick: apply the design where possible, explain the conflict, propose one fix.
- **Never commit or push until she says "commit".** Commit messages are short English imperatives, e.g. `Fix duplicate positions; show Slide x → Slide y in the header`.
- **Bump `APP_VERSION` in `panel.html`** on every panel change (footer shows it; currently 2.25). The dashboard has no version string.
- **After every shipped change, update the docs**: edit `docs/gen/gen.py` (English and Indonesian together, plus a release-notes row, the version badge and the "Updated" date), run `npm run docs`, and publish/commit `docs/slideshot-docs.html`.
- For each visual change, save a preview PNG (`npm run shot`) and tell her where it is. Say plainly what was only tested with mock data.
- Be honest and short. Report what changed, what you verified, and what she needs to decide.

## Architecture (no build step)
- Static files served by **GitHub Pages**: repo `Ridhoofrahman/Slide-preview-automation`, folder `slide-qa-marker/`. Live base URL: `https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/`. Pages deploys ~1 minute after a push.
- Backend: **Supabase** (project URL is in `slide-qa-marker/config.js`; the anon/publishable key there is public by design). Email + password auth, sign-ups disabled (an admin creates users), Postgres tables, private storage bucket `slides`, realtime.
- `taskpane.html` and `review.html` are **loaders**: they `fetch` the real app (`panel.html` / `review-app.html`) with a cache-busting `?v=` and `document.write` it, to bypass GitHub Pages' 10-minute cache. **Edit `panel.html` and `review-app.html`, not the loaders.**
- The add-in manifest (`manifest.xml`) points at `taskpane.html`. Users must reinstall only when the manifest changes (name, icons, URLs); app updates reach them when they close and reopen the panel.

| File | What it is |
|---|---|
| `panel.html` | **Designer add-in** (~97 KB, one file: CSS + HTML + JS). Single `render()` drives the UI. |
| `review-app.html` | **DM dashboard** (~155 KB, one file): sign-in, board, assign dialog, review page. |
| `slide-details.js` | Reads fonts, slide size and speaker notes from the exported .pptx (needs JSZip). |
| `slideshot-hero.js` | Canvas "flying slides" hero for the sign-in screens. |
| `config.js` | Supabase URL + anon key + dashboard URL + `DAYS_TO_SHOW`. |
| `manifest.xml`, `commands.html`, `assets/` | Add-in install files and icons. |
| `supabase-setup.sql` | **Canonical full database setup** (tables, RLS, storage, realtime). |
| `docs/` | Bilingual (EN/ID) documentation page + its generator. |
| `dev/` | Test server with mock PowerPoint/Supabase, screenshot tool, syntax check. |
| `sql/` | Incremental SQL as it was run, plus a parked stricter-security design. |

## Data model (Supabase)
- `slide_shots`: one row per **version** of a sent slide: `file_key, project (order name), slide_id (PowerPoint's internal id), slide_number (position in the order), total_slides, version, designer, designer_id, team, note, image_path, details jsonb, status ready|approved|changes, reviewed_by, reviewed_at, created_at`.
- `shot_comments`: `shot_id, author, author_id, body, x, y (pin), audio_path, audio_duration, resolved`.
- `project_status`: `key, name, sent_at, sent_by` (the "sent to customer" marker).
- `slide_assignments`: the DM's **distribution**: `order_key, order_name, assignee_id, assignee_name, assignee_team, slides int[], created_by, created_team`.
- `profiles` (`user_id, name, team`), `design_managers` (`user_id`).
- Account `user_metadata` holds `{name, team}`. Teams: **Avvenger** (exact spelling), Cascade, Clementine, Trident, Magnetic. One team per person.
- RLS today: any signed-in user can read; writes that matter (review, comments, delete, status, distribution) are **DM-only** via `is_dm()`; designers can insert their own slide_shots. A stricter per-team design exists in `sql/teams-setup.sql` (parked, not applied).

## Rules the code implements (find them before changing them)
**Orders.** An order is identified by its **digits**, any length: `123`, `#123`, `Order #123` are the same (`orderId()` in both files). The panel stores `Order #N` (`canonicalOrder`), shows `#N` (`shownOrder`), types a `#` automatically (`hashAsYouType`), and, once the DM's distribution is found, **adopts the DM's spelling** (`order_name`) so everyone's slides land in one order. The dashboard merges distributions under the matching order in `buildIndex()`.

**Panel start (`askOrder`).** First open of a deck asks "Which order is this?" (saved in the .pptx via `docStore`, keys `slideqa.orderSet|project|fileKey|workfile|map`). The order must have a distribution, otherwise "We can't find this order…" (fail-open if the lookup errors).

**Assignment tags.** `render()`: slide mine → "Assigned to you" (+ two icon buttons: change position, note); someone else's → "Assigned to Name-Team" (read-only); unassigned, or order not distributed → header tag **"Not to work"** and no buttons. Unsent assigned slides show the **"Not sent yet"** tag.

**Same Order ID, different deck.** Detected by comparing the file's slide ids with ids already sent for that order. A genuine clash blocks sending ("Order ID has already been used"); a designer who is *assigned* in that order is treated as working in a new file instead (purple note on the order step, `workfile` flag).

**Working file.** Slides of a new file are mapped, in order, onto the positions the DM assigned (`applyWorkingMap`). Manual picks come first.

**Positions** (`sentPositions`, `applyWorkingMap`, `openMapPop`, `setPosition`). The DM sees a slide at the position of its **latest sent version**. The popup's "Sent as" list contains only the designer's assigned positions; a position held by another sent slide is **disabled** ("Slide 4 · sent"), so two slides can never share a number. A sent slide may move; the new position applies from its next version. Header shows `Slide 9 → Slide 4` when moved. Unsent slides swap with a displaced slide.

**Tag team.** An order is tag team when slides or distributions involve more than one team. Each DM can decide (approve / request changes) only on **their own team's** slides (`canReview`); both see the whole deck. Designer filter chips on the review page appear when 2+ designers work on the order.

**Dashboard access.** DM-only (`isDesignManager`, reads `design_managers`; fails open if the table is missing so nobody is locked out during setup). The add-in footer shows a **Dashboard** link to DM accounts only. A designer view is planned (see open items).

**Progress.** The ring counts approved vs **sent** slides only. All approved shows a full ring; after "Send to customer" the ring is solid green with a check. "Send to customer" only marks status inside Slideshot; it does not email or notify anyone.

**Retention.** Orders are removed 30 days after last activity (`RETENTION_DAYS`, `cleanupOldProjects`, at most once a day per browser). Deleting an order also deletes its distribution; on a tag team order a DM deletes only their own team's slides.

## Design system
Figma file: `https://www.figma.com/design/DHcyMFzra5Wi7o18Uy6fW0/Slideshot` (fileKey `DHcyMFzra5Wi7o18Uy6fW0`). Node ids and what they define are in `design/FIGMA.md`. Connect the official **Figma MCP** in Claude Code to read it.
- Font **Geist** (400/500; 600 for the docs page). Brand blue **#00308D**.
- Text `#1F2430` / `#18202B`, secondary `#3F4652`, muted `#6B7280`; borders `#E3E6EB` and `#CDD2DA`; canvas `#F6F7F9`; header bar `#EEF0F3`; focus `#3D66F5`.
- Status chips: grey `#EEF0F3 / #CDD2DA / #3F4652`, yellow `#FDF5E6 / #F4CC7F / #8D5D00`, red `#FAE9EB / #CA2135`, green `#006B4B` (ring `#33C297`, solid `#008F64`), purple (Tag team, working-file note) `#EFEDF8 / #ACA4D9 / #473C90`.
- Names that were decided: "Adjust distribution" (not "Edit split"), "Dashboard" (footer link; was "Review site"), "Not to work", "Not sent yet", "Upload the latest version", "Send to customer".

## Develop and test
```bash
npm install                      # only needed for screenshots (Playwright)
npx playwright install chromium
npm run dev                      # test server on http://localhost:5173
npm run check                    # syntax check of every inline script
npm run shot -- "/panel?n=1&st=notsent&dm=1" out.png --w 320 --h 694
npm run shot -- "/review" board.png --w 1280 --h 760 --wait 2500
npm run docs                     # regenerate docs/slideshot-docs.html
```
- `/panel` runs the real `panel.html` against `dev/mock-panel.js` (fake Office.js + Supabase). Query params: `n` selected slide (1-10), `st` = `notsent` | `waiting` | `update` | `seed` (slides 8 and 9 already sent), `dm=1` makes the account a DM. In the page, `window.__sel = 8; refreshDeck()` switches slides.
- `/review` runs the real `review-app.html` against `dev/mock-review.js` (five sample orders: tag team, single slide, all approved, sent to customer, distribution only).
- Not covered by the mocks: real Office.js timing, `slide-details.js` (it needs a real .pptx), real Supabase RLS. Uda tests in real PowerPoint and reports back. Verify risky logic by reading the code paths, then say what was not run for real.
- The pages are single files with one big stylesheet each. **Grep a class name before inventing one** (`.bd-top` is already the dashboard's sticky top bar; reusing it once broke the new card layout).
- When screenshotting after a scroll, disable smooth scrolling first (`document.documentElement.style.scrollBehavior='auto'`).

## Release
1. `npm run check`, then test in the browser with the mocks.
2. Commit and push to `main` (the repo belongs to the `Ridhoofrahman` account: you need write access, or a fork).
3. GitHub Pages updates in ~1 minute. Designers close and reopen the panel; the version shows in the footer.
4. If `manifest.xml` changed: copy it to the add-in shared folder, close PowerPoint, and on Windows delete `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef` before reinstalling. On Mac the manifest lives in `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef`.
5. Update the docs page (see above).

## Current state (when this package was made)
- GitHub `main` is at commit `d8f0f76` ("Fix: sent slides can move to a new position with their next version"). Panel is v2.25.
- **Not committed yet** (this package includes them): `slide-qa-marker/review-app.html` (board order cards redesigned from Figma node 156:8747: stacked slide thumbnails, "Not sent yet" thumbnail, purple Tag team chip, "Last update" label; the hover ⋯ button moved to the card's bottom-right so it does not cover the Tag team chip) and `slide-qa-marker/manifest.xml` v1.0.3.0 (icon cache-busting for the Slideshot rename; Windows needs it replaced by hand in the shared folder).
- `docs/slideshot-docs.html` is current for panel v2.25 but does **not** yet mention the new board cards.

## Open items and decisions waiting for Uda
1. Commit the pending files above, then update the docs.
2. Figma's board card has a **Hover** state (grey card, trash icon instead of the ⋯ menu) and a **List** layout (637×50 rows). Neither is built. The menu (Assign slides, Mark as sent, Delete order) is unchanged.
3. The **Change slide position** popup in Figma shows an info line ("The slides will switch position"). Recommended replacement text: "Slide 4 will be sent as Slide 1" (updates with the dropdown). Not built yet.
4. **Designer dashboard** (workload list, team list, who works on what) is planned; the dashboard page will then open to everyone and the footer link will show for all.
5. "Send to customer" could later connect to the Inner Platform.
6. Per-designer progress on the order card (e.g. "Bela 3/5 · Rio 0/5") was discussed, not built.
7. Security: reads are open to all signed-in users; `sql/teams-setup.sql` is the parked stricter design.
8. Hosting runs on a Supabase project under a personal account. The original README asks IT/legal whether client data may be stored there; this approval is still open. Windows rollout through Microsoft 365 Admin Center needs IT.
9. A slide that is deleted and rebuilt counts as a new slide (history does not follow). Recognising a replacement slide as the next version was parked. Assignments match **slide numbers**, so if the original deck's order changes the DM must update the distribution.
10. Possible leftovers in the data: duplicate slide positions from an old bug (e.g. order #351164) need one deleted on the dashboard.
11. Logo: three concepts are in the Figma page "Logo explorations"; the mark currently used comes from Figma node 312:5348.
12. Voice-note audio playback on PowerPoint for Mac is unverified.
