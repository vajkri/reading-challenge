# Handoff — Maskot-forslag (mascot state-matrix)

_Self-contained brief for `Maskot-forslag.dc.html`. Feed this to a new session._

> **STATUS (June 27, 2026):** This file remains the **exploration matrix** (5 animals × 8 stages).
> The drawing system documented here has since been **ported into the actual app**
> (`Sommerlæsning.dc.html`) — same method names (`_faceEl`/`_base`/`_anchor`/`_eyes`/`_mouth`/
> `_acc`/`_blush`/`_confetti`/`_owlBeak`, `_arc`/`_line`/`_svg`, `STROKE = 2.6`/`BROW = 4`). For
> the app, **v1 ships cat + dog only** (chosen via a Settings picker, key `sommerlaesning.v1.mascot`);
> owl/horse/fox stay in the code but are not offered. This file is the **drawing reference / source
> of truth for face geometry**; behavior + picker wiring is in `HANDOFF.md`. If you change a face,
> keep the app's copy of these methods in sync (same source).

## What it is
A single Design Component (`Maskot-forslag.dc.html`) that shows **5 candidate mascots ×
8 happiness stages** as a table, so the user (designing a Danish kids' reading app) can pick
which animal to use. Exploration only — it is **NOT** wired into the app
(`Sommerlæsning.dc.html`). Danish UI. Warm pastel palette, fonts Baloo 2 (display) + Nunito (body).

- **Rows** = the 8 progress stages (0–9 % … 101 %+), same bands the app uses.
- **Columns** = `kat, hund, ugle, læsehest, ræv` (cat, dog, owl, horse, fox).
- Left cell of each row = a `range` tag (color-coded by difficulty), a short `stageName`, and the
  app's **caption** for that stage, using **"Max"** as the example mascot name.
- `exampleName` is a tweakable prop (default `"Max"`) — changing it re-writes every caption.

## How the mascots are drawn (important)
Each face is built **parametrically in the logic class** with `React.createElement`, NOT as
template markup. So **faces are opaque to the DC editor — the user cannot click into them.**
Every visual tweak must be done in the logic class (`dc_js_str_replace`).

Entry point: `_faceEl(animal, stage)` composes, into a `150 × 162` relative box (all children
absolutely positioned, `top/left` in px), in this order:
1. `_base(b, animal)` — the structural layers (ears, head, muzzle, nose, whiskers, mane, beak-less).
2. `_blush(b, a)` — rosy cheeks, only `stage >= 3`.
3. `_eyes(b, stage, a)` — shared eye renderer.
4. mouth: `animal==='owl' ? _owlBeak(b, stage) : _mouth(b, stage, a)`.
5. `_acc(b, stage)` — party hat / crown / bowtie.
6. `_confetti(b)` — a few static dots, only `stage >= 6`.

`b(style, kids)` is a keyed `createElement('div', …)` helper local to `_faceEl`. Styles are JS
objects (camelCase). Everything paints at a natural ~150px size; the table cell renders it at 1×.

### Stroke convention (project-wide — established, follow it)
Every **drawn facial line** (mouths, closed-eye curves, eyebrows) is rendered as an **SVG path**
with a **uniform weight and round line-caps** so strokes never taper at the ends. Documented in a
comment block at the top of the class. Helpers:
- `_arc(cx, cy, w, h, color, weight, dir)` — `dir` is `'smile'` (∪), `'frown'` (∩) or `'flat'`.
- `_line(cx, cy, len, angleDeg, color, weight)` — straight stroke, centred, rotated.
- `_svg(children)` — wraps paths in a `150×162` absolutely-positioned overflow-visible SVG.

Weights are two named constants:
- **`STROKE = 2.6`** — eyes + mouths (the user dialed this down from 4 → ~66%).
- **`BROW = 4`** — eyebrows stay heavier (they are NOT to be thinned with the eyes/mouths).

Do **not** go back to border / border-radius tricks for line work — those taper at the ends, which
the user explicitly rejected. Route all new line work through `_arc` / `_line`.

### Coordinate system
Container is `150` wide × `162` tall. Head sits low; the top ~30px is headroom for hats/crowns.
zIndex convention: ears/mane `1`, head `2`, muzzle/cheeks `3`, whiskers/disc-rim `3–4`,
eyes/mouth/blush `5`, beak/brows/accessories `6–8`.

### Per-animal anchors — `_anchor(animal)`
Returns `{ eye, mouth, blush }`. Eyes/mouth/blush are positioned from these so the shared
renderers work across animals. Current values:
- **cat**  eye `cx1:54,cx2:96,cy:62,size:15`; mouth `cx:75,cy:106`; blush `cy:86,lx:22,rx:109`
- **dog**  eye `cx1:53,cx2:97,cy:58,size:18,brows:true`; mouth `cx:75,cy:102,tongue:true`; blush `cy:80,lx:18,rx:113`
- **owl**  eye `cx1:50,cx2:100,cy:58,size:18,disc:true,discR:20`; mouth `cx:75,cy:96` (unused — see beak); blush `cy:96,lx:16,rx:115`
- **horse** eye `cx1:57,cx2:93,cy:56,size:12`; mouth `cx:75,cy:130`; blush `cy:102,lx:42,rx:89`
- **fox**  eye `cx1:54,cx2:96,cy:60,size:12,tilt:12`; mouth `cx:75,cy:116`; blush `cy:88,lx:24,rx:107`

`eye` options the renderer understands: `disc`/`discR` (owl's white eyeballs), `brows` (dog
eyebrows that steepen at higher stages), `tilt` (fox almond/sly rotation).

## Stage → expression mapping (shared, in `_eyes` / `_mouth` / `_acc`)
Stage index 0–7 maps to the same emotion ramp the app uses:
- **0** (0–9 %, "Trist") — sad: down-curved eyes + frown.
- **1** (10–24 %, "Vågen") — open eyes + flat mouth.
- **2** (25–49 %, "Lille smil") — open eyes + small smile.
- **3** (50–74 %, "Glad") — open eyes + big smile + **blush**.
- **4** (75–89 %, "Festhat") — open eyes + big smile + the **party hat**.
- **5** (90–99 %, "Butterfly") — **grin starts here**: happy closed-arc eyes + **open mouth** +
  **bowtie** (butterfly). Owl's beak also opens at 5.
- **6** (100 %, "Jubel") — happy eyes + open mouth + **confetti** (hat still on).
- **7** (101 %+, "Konge") — happy eyes + open mouth + **crown** + bowtie + confetti.

**Grin threshold = stage 5** (user moved it one stage earlier, from 6). It is keyed off `stage>=5`
in `_eyes` (closed happy eyes), `_mouth` (open mouth) and `_owlBeak` (open beak) — keep those three
in sync if you move it again.

`_mouth` variants: 0 frown (∩), 1 flat line, 2 small smile, 3–4 big smile (dog adds a tongue at 3+),
5+ open joyful mouth with a pink tongue. Smiles use `_arc('smile')`.

## Per-animal notes / decisions already made
- **Cat** — reference design; the app's actual mascot. Triangle ears w/ pink inner, whiskers,
  cream muzzle. **Recent cat-specific tuning (user-approved, do not revert):**
  - **Nose** enlarged to ~150% (pink down-triangle, `borderTop:11px`, `left:66`).
  - A short **vertical line** connects nose → mouth (`top:102,left:74`, 2×8px).
  - Mouth uses **twin downward arches** (ᴗᴗ) instead of one arch, via `mouth.twin:true` in the
    anchor. Small at stage 2 ("Lille smil"), larger at stages 3–4.
  - **Ears** sized to 120% of the original triangles and spread ~20% further apart from the
    original (outer ear `left:20.7`, inner `left:30.4`). The user converged on this after
    rejecting 200/150/125% — keep it unless asked.
- **Dog** — deliberately **cheeky** (user-approved): big sparkly eyes (two highlights), **eyebrows**
  that steepen, an asymmetric eye-patch, floppy ears, tongue at smiley stages. Do not "fix" the
  big eyes — that was the point (the old plain-dot eyes were rejected as "boring").
- **Owl** — uses a **beak instead of a mouth** (`_owlBeak`, `_mouth` is skipped for owl). One clean
  cream **facial disc** (an earlier two-overlapping-disc version was rejected for "weird layers"),
  big spectacled white eyes (user likes these), tall feather tufts. Beak is **closed** (two-tone
  orange triangle) for stages 0–5 and **opens with a little pink tongue** at stages 6–7
  (per a reference cartoon owl the user supplied). Beak is positioned ~vertically centered between
  the bottom of the eyes and the bottom of the cream disc (closed beak `top:88`, open `top:84/95`).
- **Horse** ("Læsehest") — long narrow face, **white blaze** down the center, **forelock** between
  the ears, flaring lighter muzzle with two nostrils, rounded upright ears with lighter inner.
- **Fox** — tall pointed ears with **black tips**, triangular orange mask with **spiky cheek tufts**,
  pointed **white muzzle** (teardrop) + a small white blaze up the forehead, dark nose at the tip,
  slightly tilted almond eyes.

## Accessories — `_acc(b, stage)`
- **Party hat** (stages 4–6): striped cone (`repeating-linear-gradient` salmon/green) + yellow pom,
  rotated −8°, `top:-15px` (raised so the base seats on the forehead — user-tuned across two rounds;
  do not drop it back to floating).
- **Crown** (stage ≥ 7): yellow zig-zag (`clip-path` polygon) + a salmon jewel.
- **Bowtie / "butterfly"** (stage ≥ 5): two orange triangles + a knot. **Per-animal vertical position**
  via `_bowtieTop(animal)` so it seats at each animal's chin (head bottom): cat `142`, dog `134`,
  owl/horse/fox `142`. `_acc` now takes `(b, stage, animal)`. If you restructure a head, update its
  `_bowtieTop` entry to its new `top + height`.
- Party hat / crown are uniform across all animals (shared); they currently seat acceptably on every head.

## Layout / table scaffold (template `b_dc_html`)
Plain inline-styled markup. A header grid row (`grid-template-columns:248px repeat(5,154px)`) with a
color dot + name per animal, then `<sc-for list="{{ rows }}">` rows; each row is the same grid:
a left label cell (`range` / `stageName` / `caption`) + `<sc-for list="{{ row.cells }}">` of
`{{ cell.face }}` (the React element). `rows` is built in `renderVals()`; `row.bg` alternates,
`row.tagBg`/`row.tagFg` color the range pill.

## Gotchas
- **Preview freezes animation at t=0** (the gentle `mons-bob`). Accessories therefore must be visible
  at rest — none use a "scale-from-0" entrance. Keep that rule for any new accessory.
- All faces share one renderer, so **fixing one cell fixes that stage for every animal** (and editing
  `_base`/`_anchor` for an animal changes all 8 of its stages). The user worked this way on purpose
  ("update just Lille smil… it propagates").
- To inspect a single face, scale its cell in the live preview, e.g.
  `[...document.querySelectorAll('div')].filter(d=>d.style.width==='150px'&&d.style.height==='162px')[STAGE*5+ANIMAL].style.transform='scale(2.4)'`
  (animal index: cat 0, dog 1, owl 2, horse 3, fox 4) — then **reset transforms** afterward so the
  user's live view isn't left zoomed.
- Editing: prefer `dc_js_str_replace` (hot-reloads the class, state preserved). Styling stays inline;
  no stylesheets. Never touch `support.js`.

## If the user picks an animal — DONE for cat + dog
The parametric renderer has since been **ported into `Sommerlæsning.dc.html`** (it no longer
hard-draws the cat head in template markup). The app's logic class now contains the same
`_faceEl`/`_base`/`_anchor`/`_eyes`/`_mouth`/`_owlBeak`/`_blush`/`_acc`/`_confetti` system
documented here, and the progress hero renders `_faceEl(this.state.mascot, joy, {confetti:false})`.
A **mascot picker** in Settings ("Vælg maskot", above "Maskottens navn") lets the user choose
**cat or dog**, persisted to `sommerlaesning.v1.mascot`. All five animals exist in the app's
renderer; adding owl/horse/fox to the picker is two lines each. App-side wiring (`_joy(pct)`,
the `nm` mascot-name captions, the animated confetti overlay) is documented in the main
`HANDOFF.md` sections "Mascot happiness stages" and "Mascot picker". Keep this file and the app's
copy of the renderer **in sync** — they're the same source. Copy stays generic ("maskot").

## How to preview
Open `Maskot-forslag.dc.html`. Tweak `exampleName` to preview captions with a different name.
