# Design system: Builder DS

**Every design exploration (Figma, Paper, HTML mockups, code) starts from Builder DS.** Use its tokens, text styles, shadows, components and icons. Do not invent a colour, size, radius or icon when the DS has one. If something is missing, say so and propose an addition to the DS. Do not quietly hardcode a new value.

- Library: **Builder DS** (Figma team library, already added to the Slideshot file `DHcyMFzra5Wi7o18Uy6fW0`).
- Library key: `lk-76d9bae431e360dd225a71fc8893a838af097617d6d9bf50b6ea70697f6ac365f1960248279e5d59a08d82849de616bad8f412724f1720eb917c6c25b8a2905c`
- Slideshot-specific components (order card, slide thumbnail, progress ring, review panel…) are on the Slideshot **Components** page (`347:10403`). See `design/FIGMA.md`. **They still use the old token set** (see "Migration status").
- Catalogue read from the published library on **2026-11-13**, after Uda published the new token setup. If the DS changes, refresh this file (see the end).

## Token structure (new)
| Collection | What it holds | Use it for |
|---|---|---|
| **Mapped** (74) | Semantic colours + radii: `text/*`, `icon/*`, `background/*`, `outline/*`, `elevation/*`, `divider/*`, `tooltip/*`, `radii/*` | **Everything you design.** Bind fills/strokes/radius here. |
| **Brand** (15) | `scale/*`: the number scale for spacing/padding/gap | Spacing, padding, gap |
| **Typography** (23) | `font-family/*`, `font-size/*`, `line-height/*`, `font-weight/*` | Through the `text-*` styles; directly only when no style fits |
| **Alias** | Colour primitives (`neutral/*`, `brand/*`, `success/*`, `warning/*`, `error/*`, `info/*`, `color/grey/*`) | **Never directly.** It is not published on purpose: all tokens are taken from Mapped, which refers to Alias. |

Old names `color/text/body`, `color/background/accent/grey`, `space/12`, `radii/round`… (collections *Primitive* / *Semantic*) are **retired**. Do not use them in new work.

## Typography
Font **Geist** (regular, medium, semi-bold, bold); **Geist Mono** (`font-family/mono`). Letter spacing 0.

| Style | Size / line height | Bound variables |
|---|---|---|
| `text-xs/Regular · Medium · Bold` | 12 / 16 | `font-size/xs`, `line-height/s` |
| `text-s/Regular · Medium · Bold` | 14 / 20 | `font-size/m`, `line-height/m` |
| `text-m/Regular · Medium · Bold` | 20 / 32 | `font-size/xl`, `line-height/xxl` |
| `text-lg/Medium · Bold` | 24 / 36 | `font-size/xxl`, `line-height/xxxl` |
| `text-xl/Regular · Medium` | 32 / 44 | `font-size/xxxl`, `line-height/xxxxl` |
| `text-xl/Bold` | 32 / 44, **Geist SemiBold** (style name says Bold) | `font-weight/semi-bold` |

No style exists yet for 16 px (`font-size/l` + `line-height/l` = 16/24) or 13 px (`font-size/s`). Components such as Tag and Button tag bind these variables directly.

- `font-size`: xxxs 8, xxs 10, xs 12, s 13, m 14, l 16, xl 20, xxl 24, xxxl 32
- `line-height`: xs 12, s 16, m 20, l 24, xl 28, xxl 32, xxxl 36, xxxxl 44

## Colour: Mapped tokens
### Text
| Token | Value |
|---|---|
| `text/title` | #1A1F2E |
| `text/subtitle` | #2F3547 |
| `text/body` | #454C63 |
| `text/caption` · `text/subtle` · `text/placeholder` | #6A7389 |
| `text/disabled` | #A3ADC2 |
| `text/on-color` | #FFFFFF |
| `text/color/brand` | #1C43A5 |
| `text/color/success` | #0A6139 |
| `text/color/warning` | #AD7300 |
| `text/color/danger` | #A81A1A |
| `text/color/information` | #4A2999 |
| `text/disabled/brand · success · warning · danger · information` | #3B74F5 · #12A45F · #FFB800 · #F23B3B · #7D4FE0 |

### Icon
| Token | Value |
|---|---|
| `icon/neutral` | #454C63 |
| `icon/subtle` · `icon/disabled` | #A3ADC2 |
| `icon/on-color` | #FFFFFF |
| `icon/brand` | #1C43A5 |
| `icon/success` | #0A6139 |
| `icon/warning` | #AD7300 |
| `icon/danger` | #A81A1A |
| `icon/information` | #4A2999 |

### Background
| Token | default · hover · active / hover-subtle · disabled |
|---|---|
| `background/neutral/*` | #FFFFFF · #F7F9FC · active #DDE4EE · disabled #F7F9FC |
| `background/brand/*` | #1C43A5 · #132D70 · active #EEF4FF · hover-subtle #EEF4FF · disabled #A8C3FF |
| `background/success/*` | #0C7F49 · #0A6139 · disabled #7ED9A8 |
| `background/warning/*` | #E09600 · #AD7300 · disabled #FFE08A |
| `background/danger/*` | #D62020 · #A81A1A · hover-subtle #FFF1F1 · disabled #FFB0B0 |
| `background/information/*` | #6035C4 · #4A2999 · disabled #BDA6EE |
| `background/disabled/disabled` | #EEF2F8 |
| `background/accent/neutral · brand · success · warning · danger · information` | #F7F9FC · #EEF4FF · #E6F7EE · #FFF9E6 · #FFF1F1 · #F0EBFC |

### Elevation, outline, divider
| Token | Value |
|---|---|
| `elevation/sunken` (canvas, recessed areas) | #EEF2F8 |
| `elevation/default` · `raised` · `overlay` | #FFFFFF |
| `outline/neutral` | #DDE4EE |
| `outline/brand` | #A8C3FF |
| `outline/success` · `warning` · `danger` · `information` | #7ED9A8 · #FFE08A · #FFB0B0 · #BDA6EE |
| `outline/on-color` | #FFFFFF |
| `divider/default` | #C2CCDB |
| `tooltip/default` | #1A1F2E |
| `overlay/scrim` | #1A1F2E at 50% |

### Status chips in Slideshot, mapped to the new tokens
| Chip | Background | Outline | Text / icon |
|---|---|---|---|
| Grey (Not sent yet, Not to work) | `background/accent/neutral` | `outline/neutral` | `text/body` / `icon/neutral` |
| Header bar, sunken areas | `elevation/sunken` | | |
| Page canvas | `background/accent/neutral` | | |
| Yellow (Waiting for review) | `background/accent/warning` | `outline/warning` | `text/color/warning` |
| Red (Changes needed) | `background/accent/danger` | `outline/danger` | `text/color/danger` |
| Green (Approved) | `background/accent/success` | `outline/success` | `text/color/success` / `icon/success` |
| Purple (Tag team, working-file note) | `background/accent/information` | `outline/information` | `text/color/information` |
| Blue (Assigned to you, selected) | `background/accent/brand` | `outline/brand` | `text/color/brand` |

## Spacing, radius, shadow
- **Spacing** (`Brand / scale/*`): none 0, 1 → 1, 25 → 2, 50 → 4, 100 → 6, 150 → 8, 175 → 10, 200 → 12, 300 → 16, 400 → 20, 500 → 24, 600 → 28, 700 → 32, 800 → 36, 900 → 40.
- **Radius** (`Mapped / radii/*`): xs 2, s 4, m 6, l 8, xl 12, **full 999** (pills, round avatars, rings).
- **Shadow** (effect styles, colour #121217, unchanged):
  - `Shadow/xs`: 0 1 2 0 @5%
  - `Shadow/s`: 0 1 2 0 @6% + 0 1 3 0 @10%
  - `Shadow/m`: 0 2 4 −1 @6% + 0 4 6 −1 @8%
  - `Shadow/lg`: 0 4 6 −2 @5% + 0 10 15 −3 @8%
  - `Shadow/xl`: 0 10 10 −5 @4% + 0 20 25 −5 @10%

## Components (Builder DS, republished 2026-11-13)
| Component | Variants (default size) |
|---|---|
| **Button** | Variant: Primary, Secondary, Destructive, Warning, Information, Success · **Type: Filled, Text** · Size: m, s · State: Default, Hover & active, Focus, Disabled, Loading · 117×40 (padding scale/200 × scale/400, radius l) |
| **Button Icon** | Variant: Primary, Secondary, Ghost, Destructive, Ghost destructive · Size: xs, s, m · State: Default, Hover & active, Focus, Disabled · 40×40 |
| **Button tag** | State: Default, Hover, Selected · Size: s, m · 125×32 |
| **Toggle button** | States: Default, Hover, Active · 77×32 |
| **Zoom control button** (new) | State: Percentage display, Zoom out/in hover/pressed, Fit hover/pressed, Minimum zoom, Maximum zoom, Disabled · 118×32 |
| **Tag** (label) | Color: Blue, Green, Yellow, Red, Purple, Grey · Size: s, m |
| **Tag** (badge) | Type: Solid, Number, Icon · Color: White, Green, Yellow, Blue, Red, Purple · 20×20 |
| **Fields** | Type: Text input, Dropdown, Icon no bg · State: Default, Focus, Filled, Disabled, Error, Filled - disabled · 280×68 |
| **Dropdown** | Open: No, Yes · Menu position: Above, No, Below · Size: s, m · 125×40 |
| **Tooltip** | Position: Below, Right, Top Left, Top Right · 160×36 (`tooltip/default`, `text/on-color`) |
| **Checkbox** | State: Default, Hover, Selected, Disabled · Shape: Square, Circle · with label |
| **Tab** | Tab group: 2, 3, 4 · Size: m, s (track `elevation/sunken`, radius xl) |
| **Icons** | `Icon/regular/*` (check, check-circle, circle-info, circle-stop, chevrons/chevron-down, plus, bell, bookmark, user, user-tag, Gear, image, message-lines, arrow-up-from-line, square-dashed …). Find them with `search_design_system`; export as SVG with `currentColor`. |

## Migration status (what is not finished yet in the DS)
Found while reading on 2026-11-13. Check with Uda before relying on these:
1. Alias is unpublished by design (see above). Note: two primitive families appear in the alias chains, `neutral/*` and `color/grey/*` (same values, e.g. 700 = #454C63).
2. **Old number/typography bindings were fixed on 2026-11-13** in the Builder DS file (`QMbLblwBhRXTdJLRetSG6X`): 1,529 bindings were moved to `scale/*`, `radii/*` and `font-*` with the same value (including all icons, which now use `scale/400` for 20 px). Radius 999 uses `scale/full`; radius 0 uses `scale/none`. Uda fixed the colour bindings by hand. **Audit of 2026-11-13: every active component binds only to the new collections.** Old variables remain only in the archived `.buttons` component on the Archives page and in the documentation frames on the Typography, Effects, Icon and Tab pages. Those are not components, so they were left on purpose.
3. **`text-xl/Bold` is SemiBold** (bound to `font-weight/semi-bold`), while the other Bold styles are Bold.
4. No text style for 16/24 or 13 px.
5. **Slideshot file, stage 1 done (2026-11-13):** 905 old number/typography bindings on the Add in, Review page and Components pages were moved to `scale/*`, `radii/*` and `font-*` with the same value. `radii/round` (999) was later moved to the new `radii/full`. Left on purpose: 3 chevron icons in `Summary` instances on the old **v1** frames (Add in page), whose main component "Summary/Opened old" is gone. Uda keeps v1 as is. **Stage 2 (colours) done (2026-11-13):** 769 paint bindings + 42 text ranges were moved to Mapped tokens. Decisions: canvas/bg → `background/accent/neutral`; header bar/accent grey/subtle → `elevation/sunken`; icon/secondary → `icon/neutral`; icon/red → `icon/danger` (icons) or `background/danger/default` (shapes); input border dark-grey → `divider/default`; progress ring → `outline/success`; Tag team icon purple → `icon/information`; scrim → the new `overlay/scrim`. The local collections "Slide QA / Color" and "Collection" were deleted from the Slideshot file afterwards.
   Raw-hex pass (2026-11-13): unbound old-palette hex on UI text/fills was bound to Mapped tokens too. Left on purpose: the three dialogs on the Review page (Uda will redo them), logo/illustration vectors (their colours are illustration-only), and section title annotations on the canvas.
6. **New token `overlay/scrim`** (added 2026-11-13): Mapped `overlay/scrim` → Alias `overlay/scrim-50` (hidden) → Brand `color/overlay/scrim-50` (hidden) = #1A1F2E at 50%. Used for badges over slide thumbnails and modal backdrops.
7. The **apps** (`panel.html`, `review-app.html`) still use the **old palette** (brand #00308D, body #3F4652, canvas #F6F7F9, outline #E3E6EB…). The new palette has a different brand blue (#1C43A5) and cooler greys. To move Slideshot over, accept the library update in Figma and rebind the components, then update the CSS variables in `panel.html` / `review-app.html`. That is a visible change, so only on Uda's go.

## How to use it
**In Figma (use_figma):** search with `search_design_system` and pass `includeLibraryKeys: [<key above>]`. Import with `importComponentSetByKeyAsync`, `importVariableByKeyAsync` and `importStyleByKeyAsync`. Bind colours to **Mapped**, spacing to **Brand `scale/*`**, radius to **`radii/*`**, text to the **`text-*` styles**, and shadows to **`Shadow/*`**. Do not use raw hex values.

**In code / HTML / Paper:** use the values above and name CSS variables after the token (e.g. `--text-body`, `--background-brand-default`, `--scale-200`).

**No local tokens:** the Slideshot file has no local variable collections any more. Everything comes from Builder DS.

## Refreshing this file
In the Slideshot file, run `use_figma` (read-only) with `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` → filter `libraryName === 'Builder DS'` → `getVariablesInLibraryCollectionAsync` → `importVariableByKeyAsync` and resolve aliases. Read styles and components with `search_design_system` (scoped with the library key) and `importStyleByKeyAsync` / `importComponentSetByKeyAsync`. Compare what you find with "Migration status" above.
