# Figma references

File: `DHcyMFzra5Wi7o18Uy6fW0` (Slideshot). URL pattern: `https://www.figma.com/design/DHcyMFzra5Wi7o18Uy6fW0/Slideshot?node-id=156-8747` (use `-` in the URL, `:` in the API: `156:8747`).
Pages: **Review page**, **Review page (as built)**, **From Paper** (copies of two Paper components), **Logo explorations**.

## Add-in (designer panel, 320 px wide)
| Node | What it defines |
|---|---|
| 312:5223 | Section with every panel state: Not sent yet, Add note, Waiting for review, Assigned to other, Send latest version, Adjust the slides order |
| 312:5348 | Order ID confirmation page (logo, text, field, band illustration, footer) |
| 312:5182, 314:8238 | Full-width header; "Slide 1 → Slide 6" when a slide's position changed |
| 312:5956 | Sent-slide state ("v1 sent, 5 min ago" badge, **Upload the latest version** button) |
| 312:6636 | Main panel with the two icon buttons (change position, add note) |
| 314:7804 | **Change slide position** popup (Current position / Sent as / Save) |
| 291:4949 | Assignment text styles: Assigned to you (bookmark icon), Assigned to X, Not to work |
| 296:5008 | "Order ID has already been used" error |

## Dashboard (DM)
| Node | What it defines |
|---|---|
| 156:8747 | **Board order card**: stacked slide thumbnail (variants Amount =1 / >1 / Not sent yet), ring states 0 / Some / All approved / Sent to customer, Tag team chip, hover and List variants |
| 112:895 | Board loading state (motion "Cards · Stacking motion", 2258.699 ms loop) |
| 112:1499 | Board frames |
| 701:7378 | **Activity event** component set (page Review page): Type = Sent / Approved / Changes requested / Comment / Voice note / Sent to customer × State Default / Hover; booleans Note (Sent), Quote, Pin. Built 2026-11-23 from the code as the base for Uda's redesign |
| 702:7251 | Activity · all states: every sentence variation, panel normal (day groups), panel empty, behaviour notes |
| 784:2369 | **Compile order · all states** (page Add in): C1–C8 compile panel (checking, not a DM, couldn't load, not ready, ready, compiling, stopped, done), D1–D12 Final file on Google Drive (form, name error, embedded fonts reading/found/none/error, uploading, uploaded, copied, replaced, failed, reopened file), E1–E3 dashboard card menu and review header, E4 starter slide, E5 behaviour notes. Built 2026-11-24 from the code (v2.54) as the base for Uda's redesign |
| 113:1730 | Review slide section (strip, header, panel states, banners) |
| 211:4315 | Review panel component (Waiting, Approved, No comment, Recording, Full, Older version) |
| 211:5187 | Slide list panel (bg `#F6F7F9`, border `#E3E6EB`; Uda keeps 104 px thumbnails, not Figma's 133 px) |
| 215:6514 | Review header with **Send to customer** and progress |
| 113:2031 | Dialogs (Assign slides) |
| 281:4162 | Empty order state ("The designers are busy putting together slides right now…") |
| 119:1158 | Banner component (Success / Error / Information) |
| 227:898 | View tools copied from Paper |

## How to read a node faithfully
1. `get_design_context` / `use_figma` to read size, auto-layout, fills, strokes, radius, effects and text styles.
2. Export icons (`Icon/regular/*`) as SVG from the instance; use `currentColor` where the design recolors them.
3. Build, then measure the DOM against the Figma numbers (x/y/width/height inside the frame) and compare a screenshot.
