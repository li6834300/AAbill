# AAbill Illustrations — generation spec

Style system: **「集市纸 / Market Paper」**. These are the raster spot-illustrations for the app.
Icons are hand-authored SVG (`components/icons/`) — do **not** generate those.

## Global style rules (apply to every image)

- **Flat vector.** Soft, rounded organic shapes. No outlines/strokes. No drop shadows. No 3D. No photorealism.
- **Very subtle gradients only** (a gentle warm wash is OK; hard rainbow gradients are not).
- **No faces, no text, no logos, no brand names.** Abstract friendly shapes, not characters with expressions.
- **Transparent background** (PNG with alpha) for all except the app icon.
- **Palette — use only these hex values (clean cool-neutral system):**
  - Greens: `#0B7A5B` `#07543E` `#E6F2EC`
  - Amber: `#E8912A` `#FAEEDD`
  - Clay: `#C1442E` `#FAE9E5`
  - Neutral/paper: `#F6F6F4` `#EDEEEB` `#FFFFFF`
  - Ink: `#1B1C1E` `#6B6E73`
  - Household accents (only in `settled.png`): `#2E6FB4` `#7A4E9E` `#C2185B` `#0E7C7B` `#A2662A` `#4A6B2A`
- Green is the hero colour; amber and clay are accents used sparingly. Keep it calm and clean (cool, not warm/yellow).

## Files to generate → save into this folder

| File | Size (px) | Transparent? | Content |
|------|-----------|--------------|---------|
| `hero-login.png` | 1200×900 | yes | A supermarket receipt unfurling downward and turning into two or three shopping bags. Warm, welcoming. Green + paper tones, one amber accent. |
| `empty-bills.png` | 800×800 | yes | A single folded receipt resting on a surface. Calm, not sad. Mostly paper + green. |
| `empty-items.png` | 800×800 | yes | A phone hovering over a receipt with a soft light cone between them — the "scan" gesture. |
| `settled.png` | 1200×800 | yes | 4–5 simple rounded household "blob" shapes (no faces) gathered around a table; a receipt in the middle split into equal coloured segments using the six household accent colours. |
| `claim-header.png` | 1200×600 | yes | A hand lifting one grocery item off a printed list. Wide banner crop. |

## App icon + splash (separate — solid background, NOT transparent)

| File | Size (px) | Background | Content |
|------|-----------|-----------|---------|
| `../icon.png` | 1024×1024 | solid `#F6F6F4` | The brand mark: a receipt silhouette whose bottom edge is the classic zig-zag receipt tear, split vertically down the middle into two tones of green (`#0B7A5B` / `#07543E`). Centered, generous margin. |
| `../splash-icon.png` | 1024×1024 | transparent OR solid `#F6F6F4` | Same brand mark, centered smaller (it renders at 200px on a `#F6F6F4` splash). |

(The app icon and splash live in `apps/mobile/assets/`, one level up from this folder — overwrite the existing placeholder `icon.png` / `splash-icon.png`.)

Also nice-to-have regenerations (currently under-sized placeholders):
- `../android-icon-foreground.png` — 1024×1024, brand mark inside the centre 66% safe circle.
- `../android-icon-background.png` — 1024×1024 solid `#F6F6F4`.
- `../favicon.png` — 192×192, the brand mark.

## After you generate them

Drop the PNGs into the paths above and tell me — I'll wire `hero-login` into the login screen, `empty-bills` / `empty-items` into the empty states, `claim-header` into the participant page, and `settled` into the summary stage. The wiring is a few `<Image>` lines; it's held back only so Metro doesn't error on missing files.
