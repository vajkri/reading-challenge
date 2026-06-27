# Handoff — Læseudfordring (reading-challenge app)

_Last updated: June 27, 2026_

> **Recent changes (latest session):**
> - **Mascot picker (NEW):** Settings now has a **"Vælg maskot"** card *above* "Maskottens navn"
>   letting you choose the animal — **Kat** or **Hund** for now (more later). Tap-to-select
>   (instant, persisted to `sommerlaesning.v1.mascot`, default `'cat'`), selected tile gets the
>   accent border; "✓ Maskot valgt!" confirms. Sits inside the locked-gating div like the other cards.
> - **Cat upgraded + parametric renderer ported:** the progress-screen mascot is no longer
>   hand-drawn template markup. The whole parametric renderer from `Maskot-forslag.dc.html`
>   (`_faceEl`/`_base`/`_anchor`/`_eyes`/`_mouth`/`_acc`/`_blush`/`_confetti`/`_owlBeak` + STROKE/BROW
>   conventions) is now in the app's logic class and draws `_faceEl(this.state.mascot, joy)`. The cat
>   now uses the refined explorer states (twin-arch mouth, bigger nose, grin at stage 5). All five
>   animals exist in the renderer but only cat+dog are offered in the picker. ⚠️ Faces are
>   `React.createElement` → NOT click-editable. `catColor`/`accentColor` props are threaded through.
>   Hero confetti still uses the app's animated falling-confetti template overlay (`_faceEl` is
>   called with `{confetti:false}`); the old `_confetti` static dots are unused in the hero.
>
> **Earlier this session:**
> - **Challenge lifecycle (NEW):** the app now has an explicit *challenge* concept with three
>   states — `none` / `ongoing` / `completed` — stored in `sommerlaesning.v1.challenge`. This
>   drives the whole Fremgang screen + the Settings lock. See "Challenge lifecycle" section below.
> - **Fremgang adapts to state:** `none` → gloomy mascot (forced sad stage) + "Klar til en
>   udfordring?" + **Start en udfordring** button (→ Settings). `ongoing` → the ring + evolving
>   mascot as before. `completed` → crown mascot + "Udfordring fuldført" badge + stats cards
>   (minutter læst, bøger læst) + **Start en ny udfordring** button.
> - **Settings:** the lock/unlock bar is now **only shown once a challenge is started**
>   (`challengeStarted`). In the `none` state a **Start udfordringen** button sits below the three
>   setting cards; tapping it commits the current drafts (goal/name/deadline), sets status
>   `ongoing`, and **auto-locks** the options.
> - **demoState Tweak:** new enum prop to demo each state — `Auto` / `No challenge` /
>   `Ongoing challenge` / `Challenge completed` (section "Demo"). Overrides the displayed status
>   without mutating stored state.
>
> **Earlier this session:**
> - **Læselog quick-pick:** the add form now shows a horizontal-scroll row of previously-read
>   book chips ("Læser du videre i en bog?") above the Titel field — tap one to fill title +
>   author in one tap so the kid only types minutes. See "Læselog quick-pick" section below.
> - Added a lighter `::placeholder` color (`#D8C7AC`, in the helmet `<style>`) so empty inputs
>   no longer look pre-filled. (Placeholders can't be styled inline → it lives in helmet.)
> - **Inline editing:** tapping **Ret** now turns that entry's card into the edit form *in place*
>   (no more jumping to the top). The top form is add-only. See "Læselog inline edit + flash".
> - **Edit success flash:** after saving an edit, the card flashes a green background (`#E4F1D8`,
>   .5s transition back to white) with a **✓ Rettet!** badge for ~1.5s — so it's clear which
>   reading changed when a book has several entries. Badge sits in the Ret/Slet row (right-aligned,
>   `margin-left:auto`) so card height doesn't jump when the flash ends.
>
> **Previous session:**
> - Læsemål presets changed to **300 / 450 / 600** with easy→hard colors (green `#E4F1D8`/`#5C8A3F`,
>   amber `#FBEAD2`/`#B5803A`, coral `#F8DDD3`/`#C45B40`). No text labels — number + color only.
> - Removed the "Max fester ved 100%" sentence from the Læsemål description.
> - Added a **parental lock** on the Indstillinger screen (see "Settings lock" section below).

## What this is
A simple mobile web app (in Danish) to motivate the user's ~7–9-year-old son to read.
Originally summer-only ("Sommerlæsning"), now **renamed "Læseudfordring"** so it works
year-round (summer or winter). Two core ideas: a **progress screen** with a big circular
tracker + a chosen mascot (cat or dog) that gets happier as you progress, and a **reading log**
with full CRUD.

## Files
- **`Sommerlæsning.dc.html`** — THE app. Design Component (`.dc.html`). This is the deliverable.
  ⚠️ Filename is still `Sommerlæsning.dc.html` (not renamed to avoid breaking refs). The
  in-app display name is "Læseudfordring". Rename the file only if the user asks.
- **`Maskot-forslag.dc.html`** — a **state matrix** (table) showing 5 candidate mascots
  (kat, hund, ugle, læsehest, ræv) drawn at all 8 happiness stages (0–9 % … 101 %+), with the
  app's caption text per stage using "Max" as the example name. The mascots are built
  parametrically in the logic class (`_faceEl(animal, stage)` → shared `_eyes`/`_mouth`/`_blush`/
  `_acc`/`_confetti` + per-animal `_base`/`_anchor`). The dog is intentionally "cheeky" (big
  sparkly eyes, eyebrows, eye-patch). Exploration only — NOT used by the app. `exampleName` is a
  tweakable prop (default "Max"). NOTE: faces are React.createElement, so not click-editable.
- **`support.js`** — DC runtime, auto-generated. Never edit.

## Confirmed requirements & decisions
- **Language:** Danish throughout.
- **Audience:** son aged 7–9. Playful but soft/pastel visuals.
- **App name:** "Læseudfordring" (generic, not season-specific). Copy avoids "sommer".
- **Mascot (UPDATED):** v1 lets the user **choose between a cat and a dog** (Settings → "Vælg
  maskot" picker; more animals possible later). Stored in `sommerlaesning.v1.mascot`
  (`'cat'`|`'dog'`, default `'cat'`). **All copy refers to it generically** ("Maskottens navn",
  "Hvad skal jeres maskot hedde?", "Hvilket dyr skal følge jer på udfordringen?") so it reads for
  either animal.
  - The mascot **name is user-editable** in Settings. **Default = "Max"**. Stored in
    localStorage and woven into the progress-screen captions + the Læsemål description.
- **Palette:** warm pastel + amber accent (`--accent #F6A623`, cat `--cat #F4A35C`,
  background `#FFF6E9`). Fonts: Baloo 2 (display) + Nunito (body).
- **100% is not the cap:** progress can exceed 100%; at **101%+** the cat reaches its
  happiest state (gets a crown).
- **Persistence is critical:** entries + goal + name + deadline saved to `localStorage` and
  must **NOT reset** between sessions. Keys (kept stable on purpose — do NOT rename or the
  kid's progress is wiped):
  - `sommerlaesning.v1.entries`
  - `sommerlaesning.v1.goal`
  - `sommerlaesning.v1.name`
  - `sommerlaesning.v1.deadline`  (ISO `YYYY-MM-DD` string, may be empty)
  - `sommerlaesning.v1.locked`  (`'1'` = locked, `'0'`/absent = unlocked)
  - `sommerlaesning.v1.challenge`  (`'none'` | `'ongoing'` | `'completed'`)
  - `sommerlaesning.v1.mascot`  (`'cat'` | `'dog'`, default `'cat'`)

## Challenge lifecycle
The app revolves around a **challenge** (mascot name + goal minutes + deadline). Status lives in
`sommerlaesning.v1.challenge` and is computed each render into `status` (`none`/`ongoing`/`completed`).
- **Migration** (in `componentDidMount`): if the key is absent, existing users are mapped to
  `ongoing` when they already have entries or were locked, else `none` (then persisted). If an
  `ongoing` challenge already meets its goal on load, it's bumped to `completed`.
- **Demo override:** the `demoState` prop (`Auto`/`No challenge`/`Ongoing challenge`/
  `Challenge completed`) overrides the displayed `status` for screenshots/demos WITHOUT touching
  stored state. `Auto` = use the real persisted status.
- **Mascot joy by status:** `none` → forced sad (stage 0, "gloomy"); `completed` → forced crown
  (stage 7); `ongoing` → progress-driven `_joy(pct)` as before.
- **Fremgang views** (sc-if on `isNone`/`isOngoing`/`isCompleted`):
  - `none`: gloomy mascot + "Klar til en udfordring?" + `startSub` copy + **Start en udfordring**
    button (`goStart` → Settings).
  - `ongoing`: caption + ring + deadline chip (deadline chip is now gated to `ongoing` only).
  - `completed`: green "Udfordring fuldført" badge, "Sådan! I nåede målet" + `doneSub`, two stat
    cards (`total` minutter, `bookCount` bøger — `bookWord` handles bog/bøger), + **Start en ny
    udfordring** button (`goNewChallenge` → `_newChallenge`).
- **Transitions:**
  - `_startChallenge()` (Settings button): commits goal/name/deadline drafts, sets `ongoing`,
    sets `locked:true`, persists all keys, navigates to Fremgang.
  - **Auto-complete:** `_saveEntry` checks if an `ongoing` challenge's new total ≥ goal → sets
    `completed`, persists, jumps to Fremgang. (Completion is automatic at 100%, not manual.)
  - `_newChallenge()` (completed button): sets `none`, unlocks, goes to Settings to reconfigure.
    **Non-destructive** — entries/läselog are kept, so progress is cumulative (a new higher goal
    carries existing minutes forward). Open question: whether each challenge should reset to 0%.

## Settings lock (parental lock)
The Indstillinger screen can be **locked** so the kid can't change goal/name/deadline by accident.
The lock/unlock bar is **only rendered once a challenge is started** (`challengeStarted`); in the
`none` state the options are open and a **Start udfordringen** button sits below the three cards
(`_startChallenge` auto-locks on start). The intended journey: a parent configures the app and
taps **Start udfordringen** (auto-locks), and can later **Lås op** to adjust mid-challenge.
- **State:** `locked` (loaded from `sommerlaesning.v1.locked`), default **unlocked**.
- **Unlocked:** a white status card at the top with a green open-padlock icon + a **Lås** button
  (`_lock()` → sets `locked` + persists `'1'`).
- **Locked:** an amber status card with a closed-padlock icon + a **Lås op** button. The three
  setting cards are wrapped in a gating div that sets `pointer-events:none` + `opacity:.5`
  (via `lockedPE` / `lockedOpacity` in `renderVals()`), so nothing inside is interactive.
- **Parent gate:** "Lås op" opens a fixed-overlay modal (`unlockOpen`) posing a random addition
  problem `uA + uB` (each 2–9). `_submitUnlock()` checks the answer: correct → unlock + persist
  `'0'`; wrong → flash "Prøv igen!" (`unlockError`) and regenerate the numbers. `_openUnlock()`
  generates a fresh sum. Tapping the backdrop or **Annuller** closes; inner card uses `stop`
  (stopPropagation) so taps inside don't dismiss.
- Padlock icons are simple inline SVG (rect body + arc shackle), tinted to match each state.

## App structure (3 tabs, bottom nav)
1. **Fremgang (Progress)** — circular SVG ring with big % in the middle, total/goal minutes,
   the evolving cat head, a caption line, and (when a deadline is set) a **countdown chip**
   below the ring ("X dage tilbage" / "Sidste dag!" / "Tiden er udløbet").
2. **Læselog (Reading log)** — add/edit/delete entries. Fields: Titel, Forfatter, Dato,
   Minutter. Sorted newest-date first. Shows total minutes. Inline delete confirmation.
   When the add form is open, a **quick-pick book row** sits above the Titel field
   (see "Læselog quick-pick" section below).
3. **Indstillinger (Settings)** — four separate white cards, in this order (all inside the
   locked-gating div):
   1. **Vælg maskot** — Kat / Hund tap-to-select picker (instant + persisted). See "Mascot
      picker (Settings)" below.
   2. **Maskottens navn** — name field + Gem (default "Max").
   3. **Læsemål** — presets **300 / 450 / 600** (easy/medium/hard, color-coded, no labels) +
      custom minutes field + Gem.
   4. **Slutdato** — date input + Gem (the deadline).
   Each of cards 2–4 has its **own Gem button** and own "✓ … gemt!" confirmation (the picker
   uses tap-to-select, no Gem). Goal/deadline live in Settings (not the progress screen) so
   they're less accessible to the kid. A **lock bar** sits above these cards (see "Settings lock").

## Læselog quick-pick (continue a book)
Lets the kid re-log a book they're reading over many days without retyping title + author.
- Computed in `renderVals()` as `recentBooks`: iterates the already-sorted (newest-first)
  `entries`, dedupes by `title|author` (lowercased), skips entries with no title, caps at **8**.
  Each item exposes `title`, `byline` (author or "Ukendt forfatter"), `bgColor`/`borderColor`
  (highlighted amber when it matches the form's current title+author via `curKey`), and a
  `pick()` that sets `form.title` + `form.author` (leaves date/minutes alone).
- `hasRecentBooks` gates the row; only shown while the form is open.
- Template: a `<sc-if hasRecentBooks>` block above the Titel `<label>`, label
  "Læser du videre i en bog?" + a horizontal-scroll flex row of `<sc-for recentBooks>` chip
  buttons (negative side margins so chips can bleed to the card edges).
- Note: works for both add and edit forms, but really aimed at adding. No new storage keys.

## Læselog inline edit + flash
- **Inline edit:** the add/edit form is reused, but rendered in two places. Top form gates on
  `formAddOpen` (`formOpen && !editId`) → add only. Inside the `<sc-for>`, each entry has
  `editing`/`notEditing` flags; when `editing`, the card is replaced by an inline copy of the
  form (same `form.*` state + `setTitle`/`setAuthor`/`setDate`/`setMinutes`/`saveEntry`/`closeForm`
  bindings, "Ret læsning" header, "Gem ændringer" button — no quick-pick row). `_openEdit` sets
  `editId` so the right card swaps; while editing, the add button is hidden (`formClosed` false).
- **Flash:** `_saveEntry` captures `editedId` and sets `flashId` to it, clearing after 1.5s
  (`this._ft`). Per entry: `flashing` (= id===flashId) and `cardBg` (`#E4F1D8` when flashing else
  `#fff`, with a .5s background transition). The **✓ Rettet!** badge (`#5C8A3F`, inline SVG check)
  lives in the Ret/Slet action row, right-aligned via `margin-left:auto`, so the card height is
  unchanged when the flash ends. Adds (non-edit) do NOT flash — `flashId` only set on edit.

## Mascot happiness stages (parametric renderer)
The progress-screen mascot is **no longer hand-drawn in template markup**. The full parametric
renderer from `Maskot-forslag.dc.html` now lives in the app's logic class and the hero renders
`_faceEl(this.state.mascot, joy, {confetti:false})`. The chosen animal (`cat` or `dog`, via the
Settings picker — see "Mascot picker" below) is **head-only** (no body/tail). Stage selection is
still driven by `_joy(pct)`; captions are built from the mascot name (`nm`) in `renderVals()`.

Ported renderer methods (kept in sync with `MASKOT-HANDOFF.md` — same source): `_faceEl`,
`_base`, `_anchor`, `_eyes`, `_mouth`, `_owlBeak`, `_blush`, `_acc`, `_confetti`, `_bowtieTop`,
`_svg`/`_arc`/`_line` + the `STROKE = 2.6` / `BROW = 4` stroke convention. All five animals
(cat/dog/owl/horse/fox) exist in the renderer; only **cat + dog** are offered in the picker.
⚠️ Faces are `React.createElement` → **NOT click-editable**; tweak them in the logic class.
`catColor` (cat head) and `accentColor` (bowtie) props are threaded through `_base`/`_acc`.

Stages (cat now uses the refined explorer states — twin-arch mouth, larger nose, **grin starts
at stage 5**):
- **0–9%** — sad (frown, downturned eyes)
- **10–24%** — neutral (flat mouth)
- **25–49%** — gentle small smile
- **50–74%** — big smile + blush
- **75–89%** — striped **party hat** (salmon/green stripes)
- **90–99%** — open-mouth grin (closed happy eyes) + **bowtie**
- **100%** — open joyful mouth + **confetti** (hat still on)
- **101%+** — **crown** = happiest state
Hero confetti still uses the app's **animated falling-confetti template overlay** (`showConfetti`,
plays ~3s then stops); `_faceEl` is called with `{confetti:false}` so the renderer's static
`_confetti` dots are unused in the hero. Motion is intentionally **subtle** (gentle bob).

## Mascot picker (Settings)
A **"Vælg maskot"** card sits at the top of the locked-gating div in Indstillinger, **above**
"Maskottens navn". Two tap-to-select tiles (**Kat** / **Hund**), each showing a scaled-down
`_faceEl(animal, 3, {confetti:false, bob:false})` preview. Selection is **instant + persisted**
to `sommerlaesning.v1.mascot` (default `'cat'`) via `_pickMascot(m)`; the active tile gets the
accent border + amber bg (`catBorder`/`dogBorder`/`catBg`/`dogBg` in `renderVals()`), and a
"✓ Maskot valgt!" flash shows for ~2.2s (`mascotSaved`). Because it lives inside the lock-gating
div, the picker is disabled while Settings is locked, like the other cards. Adding more animals
later is two lines per tile (the renderer already supports them). Copy stays generic ("maskot").

## Implementation notes / gotchas
- Single Design Component (template + `class Component extends DCLogic`). All styling **inline**.
  Only `@font-face`/`@keyframes`/resets live in `<helmet>` — plus one `input::placeholder`
  rule (`#D8C7AC`) that can't be inline.
- Theme colors via CSS vars `--accent` / `--cat` from props in `_applyTheme()`. Editable
  props/tweaks: `accentColor`, `catColor`, `startGoal`, and `demoState` (enum, section "Demo").
- **Deadline countdown** is computed in `renderVals()` (days between today and the ISO
  deadline) → `showDeadline` + `deadlineLabel`.
- Save methods: `_saveGoal()` (goal only), `_saveDeadline()` (deadline only),
  `_saveName()` (mascot name). Each persists its own key + flashes a confirmation for ~2.2s.
- **Animation gotcha:** the preview iframe freezes the animation timeline at t=0, so any
  accessory using a "scale from 0" entrance animation renders invisible in screenshots.
  Accessories are visible at rest (no entrance transform). Keep this in mind for new accessories.
- Dates formatted with `toLocaleDateString('da-DK', …)`.
- `data-comment-anchor="9ef78cf749-div"` sits on the "Maskottens navn" heading — leave it
  attached if you move/edit that card.

## Likely next steps / open ideas
- Optional: swap the drawn cat for a real mascot image, or actually let the animal change
  (the "generic mascot" copy already anticipates this).
- Optional: a "reset progress" button in Settings (not yet built).
- Possible: streaks, weekly goals, or a sticker/reward shelf.
- Possible: use the deadline to compute a "needed minutes/day" pace hint.

## How to preview
Open `Sommerlæsning.dc.html`. To test states, seed localStorage, e.g.:
`localStorage.setItem('sommerlaesning.v1.goal','1000')`,
`localStorage.setItem('sommerlaesning.v1.deadline','2026-08-15')`,
`localStorage.setItem('sommerlaesning.v1.name','Max')`,
`localStorage.setItem('sommerlaesning.v1.entries', JSON.stringify([{id:'a',created:1,minutes:800}]))`
then reload. Reset for the kid with an empty `[]` entries array.
