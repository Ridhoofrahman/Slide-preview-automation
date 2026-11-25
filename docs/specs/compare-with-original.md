# Compare with original, v1 spec

Agreed with Uda on 21 Nov 2026. Save as `docs/specs/compare-with-original.md`.

**Build order:** do the spike first (section 9) and report the results before building the UI.

## 1. What it is
A designer chooses the customer's original `.pptx` once per deck. Slideshot then compares the text of the slide that is open with the original slide at the same order position, and lists what differs: numbers, words and missing text. It works on slide text, tables, charts and speaker notes.

Ground rules:
- **Everything runs inside the panel.** No server, no AI, nothing uploaded.
- **It never blocks sending.**

## 2. Figma
File `DHcyMFzra5Wi7o18Uy6fW0`:

| Node | What it shows |
|---|---|
| `541:4724` (section "Content check") | Panel states: Not sent yet (bar closed, `+`), Analyzing, All good, Mismatch detected, Error |
| `672:11543` | Designer moved to another slide: bar closed, original still connected |
| `585:6143` | Mismatch list with category + location titles |
| `667:11057` | Analyzing progress bar: `background/brand/default` with diagonal stripes |

Component **Slide checker** has the states Closed, Opened, All good, Missmatch detected, Error 1 and Error 2. Uda will update Figma for the decisions below; this spec wins where Figma is not updated yet.

## 3. Behaviour
1. **No original yet.** The bar reads "Compare original" with `+`. Clicking `+` opens a file picker that accepts `.pptx`.
2. **First read.** Slideshot reads the whole original once (all slides), keeps only the extracted text on this computer, then checks the active slide and opens the bar.
3. **Opening the bar checks the active slide.** Each open runs a fresh check, as does **Check again**. While checking, show the striped brand progress bar. Animate the stripes, and keep them still under `prefers-reduced-motion`.
4. **Switching slides** collapses the bar. The original stays connected. The collapsed bar shows "Compare original" and the file name, **without the ×**. Clicking the bar checks the new active slide.
5. **The open bar** fills the space from below the "Mark slide N ready" button down to the footer.
   - The file row (file name, ×) and the status row (count, Check again) stay pinned at the top.
   - The list scrolls under them.
   - The slide preview and the send button stay visible.
6. **The × appears only while the bar is open.** It removes the connected original and deletes its stored text.
7. **There is no Ignore.** Designers who keep a change simply send the slide.

## 4. Status row (compact, the space is small)
- Differences found: "7 differences found", or "1 difference found" for one. Right side: **Check again**. Use an amber dot.
- **Moved slides:** when the slide's order position is not its file position (e.g. "Slide 9 → Slide 4"), the status names the original slide, e.g. "7 differences vs original slide 4". Uda will review the wording.
- Nothing differs: "Text matches the original", with a green dot.
- Errors: red dot, message, and **Try again** where a retry makes sense.

| Case | Text |
|---|---|
| Not a .pptx | Choose a .pptx file |
| Password-protected | This file is password-protected. Choose a copy without a password. |
| Original is shorter | The original has 12 slides, so there's no slide 14 to compare. |
| Anything else | Couldn't check this slide. · Try again |

## 5. Sections: category + location
**Categories:** `Numbers changed`, `Words changed`, `Missing text`.

**Locations:**
- slide text has no suffix;
- `in table`;
- `in chart`;
- `in speaker notes`.

Section titles carry the count, e.g. "Numbers changed (2)", "Missing text in speaker notes (1)". Order:
1. slide text: Numbers changed, Missing text, Words changed;
2. then the same three categories for table;
3. then chart;
4. then speaker notes.

Hide empty sections.

**Changed rows** (numbers, words):
- Two columns, `Original` and `Your slide`.
- Show a window of the sentence around the difference, with `…` on cut sides, so the difference is always visible.
- Highlight the differing tokens: Figma uses yellow `#FFEFBD` for the original and red `#FFDADA` for your slide; map them to the matching Builder DS tokens.

**Missing rows:** one column, `Original`, plus a copy button.

**Bullseye** (changed rows only) selects the differing text on the slide:
- **Slide text:** select exactly the differing characters in the shape. PowerPointApi 1.5 has `TextRange.setSelected()` and `start`/`length`. Find the shape on the active slide whose text contains the slide-side sentence, then select the token inside it.
- **Table:** select the cell text if the API allows it; otherwise select the table shape.
- **Chart:** select the chart shape.
- **Speaker notes:** no bullseye; notes can't be selected from an add-in.
- No tooltip and no selected state. Give it the accessible name "Select on slide".

**Copy** (missing rows) copies the original text:
- On success the icon becomes a check for ~1.5 s, then returns to the copy icon. Announce "Copied" to screen readers.
- Use `navigator.clipboard` if available. Otherwise fall back to a hidden textarea and `document.execCommand('copy')`. Test both on Mac and Windows.

## 6. Comparison engine
**Reading.** Use one reader for both the original and the current slide (JSZip, as `slide-details.js` already does):
- slide text, including grouped shapes;
- table cells;
- charts: titles, axis titles, category labels and series names from the chart XML;
- speaker notes from `notesSlide`.

Every text block keeps its location type.

**Slide order.** Take the original's slide order from `ppt/presentation.xml` (`sldIdLst`) and its rels. Do **not** use the slide file names; they are often out of order.

**Current slide.** Use the active slide's existing export (`exportAsBase64`), parsed the same way.

**Which original slide.** The order position `cur.n`. This already covers working files and "Change slide position".

**Exact match, as decided.**
- Ignore only layout: line breaks, repeated spaces, bullet characters.
- Everything else counts: punctuation, decimal separators, capitals, quotes, and customer typos the designer fixed.

**Matching**, per location type first, then across locations:
1. Split into sentences or lines (soft line breaks count as spaces).
2. Pair each original segment with its most similar segment on the slide in the same location, above the similarity threshold (0.5, from the spike).
2b. Segments still unpaired are then paired across slide text, table and chart (a redesign often turns a table into text boxes or the other way round). Speaker notes only pair with speaker notes. A finding keeps the original's location in its section title. (Decided 23 Nov 2026.)
3. Diff the paired segments word by word.
4. Classify:
   - a differing token containing a digit → **Numbers changed**;
   - otherwise → **Words changed**;
   - an original segment with no pair → **Missing text**;
   - slide segments with no pair → **Added text** (v2.49; was not shown in v1). One column `Your slide`, plain text, bullseye. Not counted as a difference: status reads e.g. "2 differences found · 3 added". Hidden when it is a 3+ word part of an original sentence (a sentence split in two).

## 7. Storage and privacy
- Store the extracted original text as JSON in IndexedDB on the designer's computer. Key it by order, plus the file's name, size and last-modified date.
- Never store it inside the `.pptx` (document settings travel to the customer), and never send it to Supabase or anywhere else.
- Clearing Office's add-in cache may delete it. The designer then chooses the file again.

## 8. Lightness targets (check them in the spike)
- **Panel start-up:** unchanged. Lazy-load the compare code on first use.
- **Per-slide check:** under 0.5 s.
- **Reading a 100 MB+ original once:** under 5 s, with no memory spike. JSZip loads the whole file into memory; if that is too heavy, read only the zip's directory and XML entries (e.g. a range-based zip reader on the `File`). Media must never be decompressed.
- **Failure:** any failure shows the error state, and sending keeps working.

## 9. Spike first (report before building the UI)
1. Does a `.pptx` file picker work inside the task pane on PowerPoint for **Mac** and **Windows**?
2. Read a real large deck (100 MB+): time and memory.
3. Coverage on 3–5 real customer decks: are table, chart and notes text all extracted? Is slide order correct?
4. Selection: can a table **cell's** text be selected, or only the table? Does `setSelected` on a substring work on both platforms?
5. Clipboard copy from the task pane on both platforms.
6. False positives on real decks: tune the similarity threshold until differences are real.

## 9b. Spike results (23 Nov 2026)
Tested with `slide-qa-marker/compare-original.js` (engine) and `slide-qa-marker/spike-compare.html` (temporary test page, opened by clicking the panel version 5 times), on PowerPoint for Mac 16.115 and Windows 16.0.20527 (WebView2, Edge 157), plus 9 customer decks and a 131 MB test deck locally.

| # | Question | Mac | Windows |
|---|---|---|---|
| 1 | `.pptx` file picker in the task pane | works | works |
| 2 | Read the original | 188 slides / 15 MB in 388 ms | same deck in 2.2 s, JS heap flat (8 MB) |
| 2 | 131 MB deck (local, Chromium) | range reader 24 ms, heap 2 → 4 MB; JSZip whole file 141 ms, heap 139 MB | — |
| — | Per-slide check (export + read + compare) | 96–141 ms | 151–270 ms |
| 3 | Coverage | slide text, grouped shapes, `mc:AlternateContent`, tables, charts (titles, axes, series, categories), SmartArt, notes; order from `sldIdLst` (verified with a reordered copy) | same engine |
| 4 | `setSelected` on a substring | exactly the characters | exactly the characters |
| 4 | Table cell text | not selectable (`TableCell` has no `textFrame`); the table shape is | same |
| 5 | Clipboard | `navigator.clipboard` and `execCommand` both work | both work |
| — | IndexedDB survives closing the panel | yes | yes |
| — | `DecompressionStream`, PowerPointApi 1.9 | available | available |

**Decisions from the spike:**
- Zip: read only the central directory and the XML parts with `Blob.slice()` + `DecompressionStream('deflate-raw')`; never JSZip on the whole original. Media are never decompressed.
- Read time grows with the number of slides, not the file size; Windows reads about 6× slower than Mac, so the first read needs the striped progress bar.
- Similarity threshold **0.5** (0.3–0.5 give the same result on the test pair; 0.6+ turns small changes into "Missing").
- Soft line breaks (Shift+Enter) count as spaces; two original sentences merged into one slide sentence are not "Missing".
- Tables: the bullseye selects the table shape.
- False positives on Kingfish v4 vs its revision: 22 → 6 after matching across locations (all 6 real); a deck against itself gives 0.

**Decided (Uda, 23 Nov 2026):** spacing changes are shown (`Value(1)(3)` → `Value (1)(3)` is a difference, as "everything counts"). The limits go in the docs: text inside embedded Excel/OLE objects and chart data values are not checked.
Matching across locations is decided too (section 6, step 2b).

## 10. Out of scope for v1
Ignore; DM visibility of check results; a deck-wide check; choosing a different original slide (split or merged slides); a replacement list (e.g. a renamed company).

## 11. Acceptance checks
- Choose the original on slide 1. Go to slide 2: the bar is closed and the file is still connected. Open it: slide 2 is checked without choosing the file again.
- "12.5%" → "12,5%" shows under Numbers changed. The bullseye selects exactly "12,5%" on the slide.
- A sentence deleted from the notes shows under "Missing text in speaker notes (1)", without a bullseye. Copy turns into a check for ~1.5 s.
- A slide sent as position 4 is compared with original slide 4, and the status says so.
- With 10 sections of results the list scrolls, while the status row and Check again stay visible.
- The panel opens as fast as before. No network request is made during a check.
- Choosing a `.key` or a password-protected file shows the right error, and the slide can still be sent.

## 12. After shipping
Bump `APP_VERSION`, then update `CLAUDE.md`, the docs page (EN + ID) and the release notes.

## Formatting check (v2.57, Figma 860:18629)

- **What counts:** formatting that differs on words that are otherwise the same (paired sentences, equal words), both ways since v2.58: lost on the slide or added on the slide.
  - Superscript and subscript: always. Unicode ² ₂ stay as text: "m²" in the original and "m2" in superscript on the slide (or the other way round) are reported as a word change.
  - Bold, italic, underline, strikethrough: only as emphasis, i.e. some words of that side's sentence have it and others don't. A sentence that is entirely bold (on either side) is treated as a design choice.
- **Source:** only formatting set on the run itself (`a:rPr` attributes `b`, `i`, `u`, `strike`, `baseline`). Formatting inherited from the shape, layout or master is not resolved. Slide text, tables and notes are checked; charts and SmartArt are not.
- **UI:**
  - Section "Formatting changed" shows the original words styled as they look.
  - Counted apart in the status line (e.g. "· 2 formatting").
  - The feather icon opens a popover with only the toggles B, I, U, S (v2.59). Tooltips read "Check bold" etc. so they are not mistaken for formatting buttons.
  - Off by default. A toggle applies at once: the engine always computes every difference and the panel filters, so there is no new export.
  - The feather is blue while any toggle is on.
  - Settings are stored per computer in localStorage `slideshot.fmtCheck`. Superscript and subscript are always checked.
- **Stored originals:** the stored original keeps a `v: 2` marker. Older ones show "Formatting isn't checked: choose the original again."
