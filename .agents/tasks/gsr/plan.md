# Implementation Plan — Wordt "Game Show Set" Visual Redesign

Redesign both clients (phone `client-play/` :5173, TV `client-tv/` :5174) into one
shared "Game Show Set" visual system: deep teal ground, mustard-amber accent,
coral urgency, cream 3D letter tiles, Anton display + Hanken Grotesk body,
color-block panels, countdown fixture, scoreboard standings, architectural
podium. **DESIGN.md is THE LAW** — every token, font, radius, spacing, motion,
and form rule below is copied from it. Do not improvise colors or fonts.

Work directly in the workspace (no worktree). This is a CSS-rewrite + font
loading + targeted TSX (markup/styling only) task. **Behavior is frozen**: no
logic, props, state, handlers, socket protocol, or component-behavior changes.
Text that the Playwright e2e (`scripts/e2e.ts`) asserts must not change (listed
in "Frozen" below); eyebrow/border/SVG-color changes are sanctioned and do not
touch those assertions.

---

## 1. Authority — tokens, fonts, form, motion (copy exactly)

### Token block (paste into BOTH `:root`, identical, verbatim)

```
--bg: #0E3A47;        /* deep teal studio ground (cyclorama) */
--surface: #144A59;   /* elevated teal panel */
--surface-2: #1A5868; /* raised teal — inputs, chips */
--ink: #F5EFE3;       /* warm cream text (studio-lit white) — replaces old --text */
--muted: #8DA8AE;     /* teal-tinted secondary text (never gray) */
--accent: #F4A536;    /* mustard amber — primary "lights up" accent */
--accent-ink: #1A1206;/* dark ink on amber */
--hot: #E8435A;       /* coral — secondary accent: selected/active borders, urgency */
--tap: #FFD23F;       /* bright amber-yellow — selected letter keys, the "lit" state */
--tap-ink: #1A1206;   /* ink on lit keys */
--tile: #F5EFE3;      /* cream letter tiles (central object, kept) */
--tile-ink: #1A1206;  /* ink on tiles */
--good: #3DDC97;      /* valid / accepted */
--bad: #FF5D6C;       /* invalid / urgent / error */
--line: rgba(244, 165, 54, 0.22); /* subtle amber-tinted hairline (replaces old purple) */
```

Also keep a `--radius` convenience if helpful, but the radius scale is fixed
(see Form). The old `--text` token is **removed**; the body and every
`color: var(--text)` becomes `var(--ink)`. The old `--good-ink`/`--bad`-ink
helpers may be reintroduced only if needed; prefer `--tile-ink`/`--ink`.

### Team color map (use everywhere a team is identified)

```
A → #F4A536  (amber)
B → #E8435A  (coral)
C → #4ECDC4  (teal-cyan)
D → #F5EFE3  (cream)
```

### Font stacks

- Display (Anton): `'Anton', system-ui, sans-serif` — wordmark, phase titles,
  big reveals, countdown values, podium scores, rank numbers, big point totals.
- Body/UI (Hanken Grotesk): `'Hanken Grotesk', system-ui, sans-serif` — labels,
  body, buttons, inputs, secondary headings, all UI text.
- No system face as the voice of the page. No gradient text. No monospace
  costume. No eyebrow/kicker above a heading (see Form).

### Form rules (DESIGN.md "Form" — follow exactly)

- **BAN eyebrow/kicker above a heading.** Remove `.eyebrow`, `.subhead`,
  `.tv-eyebrow` classes + usages; fold label info into the heading or
  restructure (per-file table in §4/§5).
- **BAN colored `border-left`/`border-right` above 1px** on cards/list items.
  Replace `.tv-pick` 6px left bar and `.tv-team--*` `inset 6px 0 0` with a
  full-width **top** accent bar (or surface elevation); keep team color ID.
- **Color-block panels**, not hairline-bordered cards everywhere: `--surface`
  panels with generous internal padding, separated by stage-floor gap.
- **Tiles** stay cream (`--tile`) + dark ink (`--tile-ink`); give a real 3D
  set-piece feel: soft **offset+blur** shadow (NOT a zero-blur halo), subtle top
  highlight, chunky presence. (Existing `.tv-value__letter` already has an
  inset-bottom shadow — extend that treatment to all cream tiles.)
- **Spacing:** tight groups, generous separation, more space above a heading
  than below it.
- **Radius scale (consistent):** 20px large set-piece panels, 14px standard
  cards/buttons, 10px tiles/chips.

### Motion rules (DESIGN.md "Motion")

- **One authored moment per transition**, not a uniform "rise" on every
  section. The **reveal sequence** (words appearing one at a time during review)
  is the hero motion. The **countdown-urgent pulse** is the one repeating motion.
- Exponential ease-out from an already-visible default. Reach past
  transform/opacity: blur, clip-path, shadow belong to the palette when smooth.
- **Keep `prefers-reduced-motion` guards** (both files already have one; keep
  and keep it covering every animation).

### Browser surfaces (DESIGN.md "Browser surfaces")

- `::selection` themed from palette (e.g. `background: var(--accent);
  color: var(--accent-ink);`).
- `caret-color: var(--accent);` on text inputs.
- Custom scrollbars on `.tv-feed` (TV) and the phone word list (`.wordlist`
  scroll container if it scrolls; otherwise the screen scroll) using
  palette colors (`--surface-2` thumb, `--bg` track, amber hairline).
- Focus rings via `--accent` (many components already use
  `outline: 2px solid var(--accent)`; keep and make consistent).
- `text-underline-offset` on links (`.rules-link`, `.tv-link` already have it;
  keep).
- `font-variant-numeric: tabular-nums` on **all scores, counts, and timers**
  (much already exists — keep + verify; see §6).

---

## 2. OLD → NEW color remap (TSX inline + any lingering CSS hex)

During the full CSS rewrite, old hardcoded hex/rgba are replaced by tokens, so
they disappear naturally. For the **few TSX inline colors** and the SVG CSS
classes, apply this contextual map:

| Role / old value | NEW |
|---|---|
| Old ground `#0b0f1a` / `#181818` (theme-color, favicon bg, tile-ink, QR bg) | `#0E3A47` (--bg) for ground; `--tile-ink`/`#1A1206` for ink-on-tile contexts; QR bg `#144A59` (--surface) |
| Old amber-yellow `#ffd166` (favicon text) | `#F4A536` (amber, lit wordmark sign) |
| Old purple `#673AB7` (line, team A in places, medal-2, hair/shoe/ribbon) | team C `#4ECDC4` when it's team C; `--line` (amber rgba) when it's the hairline; coral `#E8435A` for decorative ribbon/hair; **team A is amber `#F4A536`** (per team map) |
| Old orange `#FF5722` (accent, body, medal-3, streak) | `--hot` coral `#E8435A` for urgency/active; `--accent` amber `#F4A536` where it was the primary accent; medal-3 → coral `#E8435A` |
| Old yellow `#FFEB3B` (tap, medal-1, cup, glows) | `--tap` `#FFD23F`; medal-1/cup → `#FFD23F`; glows `rgba(255,235,59,*)` → `rgba(255,210,63,*)` or `rgba(244,165,54,*)` |
| `#e64a19` (figure leg) | `#1A1206` (dark ink trousers) |
| `#ffc9a3` (skin) | `#F5EFE3` (cream) |
| `#fff7c4` (medal/cup gloss, sparkle) | `#F5EFE3` (cream) |
| `#e6a900` (medal star) | `#1A1206` (dark ink star on tap-yellow) |
| `#e0b500` (cup handle) | `#1A1206` (dark ink) |
| `#f7f7f7` (old text, medal text) | `#F5EFE3` (--ink) or `#1A1206` for ink-on-color |
| `#2b0007`, `#ffd9de` (bad-ink/bad-tint) | `--bad`-tint rgba(255,93,108,*) with `--ink` text |
| Confetti (both clients) | full palette/team set, SAME in both: `['#F4A536','#E8435A','#4ECDC4','#F5EFE3','#FFD23F']` |
| Phone Medal `MEDAL_TONES` silver/bronze (`#C7CFDA`/`#CD7F32` family) | **keep as-is** — silver/bronze are medal metals, not old-brand colors; only the CSS `.standing-medal__ribbon` stroke `#673ab7` → coral `#E8435A` |

Winner-figure SVG (all CSS classes, restyle coherently to amber/coral/teal/cream):
`.winner-figure__body`→coral `#E8435A`; `__leg`→ `#1A1206`; `__shoe`→teal-cyan
`#4ECDC4`; `__arm` stroke→coral; `__skin` (head+hands, currently via
`.winner-figure__head circle/rect`)→cream `#F5EFE3` (add an explicit
`.winner-figure__skin` rule); `__hair`→amber `#F4A536`; `__eye`→ `#1A1206`;
`__cheek`→coral (soft); `__smile`→ `#1A1206`; `__medal-disc`→tap `#FFD23F`;
`__medal-star`→ `#1A1206`; `__medal-gloss`→cream; `__ribbon`→coral `#E8435A`;
`__cup-metal`→tap `#FFD23F`; `__cup-gloss`→cream; `__cup-handle`→ `#1A1206`;
`__sparkle`→cream; `__shadow`→keep `rgba(0,0,0,.45)`.

TV podium medals (CSS): `--1`→tap `#FFD23F` + ink `#1A1206`; `--2`→teal-cyan
`#4ECDC4` + ink; `--3`→coral `#E8435A` + ink; their `box-shadow` glows
`rgba(255,235,59,*)`/`rgba(103,58,183,*)`/`rgba(255,87,34,*)` → matching
`rgba(255,210,63,*)`/`rgba(78,205,196,*)`/`rgba(232,67,90,*)`.

---

## 3. Class-sync strategy (CSS ↔ TSX in lockstep)

**Classes to REMOVE (delete the CSS rule AND every TSX usage together):**
- `.eyebrow` (phone) — phone `screens/Review.tsx` (9 usages).
- `.subhead` (phone) — phone `screens/Lobby.tsx` (4 `<h3 className="subhead">`).
- `.tv-eyebrow` (TV) — `screens/Review.tsx`, `screens/Results.tsx`,
  `screens/Lobby.tsx`, `screens/ValueTable.tsx`, `App.tsx`.

**New classes to ADD (add CSS rule AND TSX usage together):**
- `.reveal__title` (phone) — Anton heading for the review "Standings" step.
- `.tv-reveal__title` (TV) — Anton heading for the review "unique words" step.
- `.tv-lobby__title` (TV) — Hanken panel heading (used for "Grab your phone and
  join" and "Players").
- `.tv-feed__title` (TV) — Hanken heading for the live-feed "Just accepted".

Keep `.count` (phone) and `.tv-count` (TV) — they live inside the
converted headings. Keep all other class names unchanged.

**Frozen classes/text (e2e `scripts/e2e.ts` + `Scoreboard.test.tsx` — DO NOT
rename, remove, or change asserted text):** `.slides__dot` (7), `.room-code`,
`.standing`, `.keyboard`, `.tv-pick` (count), `.tv-watermark`, `.value-table`,
`.value-row` (15), `.input--word`, `.tv-writer`, `.tv-value` (15), `.feedback--bad`,
`.feedback--ok`, `.wordlist li`, `.reveal`, `.tv-reveal`, heading "Round 1
results", heading "Final results", heading "How to play", `.tv-standing`,
`.tv-standing--leader` (exactly 1), `.tv-crown` (≥1), `.standing--you`,
`.myround strong`, `.pill` (first matches /Round N/), `.tv-podium`,
`.tv-podium__col` (2), `.tv-confetti`, `.tv-entry__input`, `.tv-namelist li`,
`.tv-rules__card` (8). Buttons by name: How to play, ← Back, Create a room,
Create room, Join room, Make Bob/Ann host, Start game, 1m, Lock in my letters,
Add, Next, Next round, End game, Leave room, Back to entry. From
`Scoreboard.test.tsx`: keep `.winner-figure`, `.winner-figure--intro`/
`--static`, `.standing-medal`, `.standing-medal--pop`/`--static`,
`.standing__celebrate`, `.standing`, role="img" + aria-labels
"first place champion", "silver medal", "bronze medal". Changing CSS colors
on these is fine; do not rename/remove them.

---

## 4. Ordered edits

- [ ] 1. **Fonts + favicon/theme-color in BOTH `index.html`.**
      Add Google Fonts preconnect + stylesheet link in `<head>` (before
      `</head>`): `<link rel="preconnect" href="https://fonts.googleapis.com">`,
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
      `<link href="https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">`.
      Update `<meta name="theme-color">` `#0b0f1a` → `#0E3A47`. Update the
      favicon SVG: `fill='%230b0f1a'` → `'%230E3A47'`, `fill='%23ffd166'` →
      `'%23F4A536'`.
      Files: `client-play/index.html`, `client-tv/index.html`.
      Verify: `npm.cmd run build` — both client builds succeed (Vite inlines the
      index.html; fonts load from network at runtime, not at build).

- [ ] 2. **Rewrite `client-play/src/styles.css` fully (token block + every
      component rule) to the Game Show Set.** Replace the `:root` token block
      with §1 tokens (drop `--text`, add `--ink`/`--hot`/`--tap-ink`/`--tile-ink`).
      Set `body { font-family: 'Hanken Grotesk', system-ui, sans-serif; }` and
      apply Anton to display elements via a shared rule or per-component. Restyle
      every section; major sections to restyle with game-show-set treatment:
      - **Layout/shell:** `.app` (keep ~34rem max-width), `.topbar`, `.brand`
        (Anton amber lit-sign wordmark), `.topbar__code`, `.pills`/`.pill`/
        `.pill--phase` (solid amber-tinted pill), `.screen`, `.splash`.
      - **Controls:** `.btn`/variants (`.btn--primary` amber+ink, `.btn--ready`
        tap pulse recolored, `.btn--danger` coral), `.input`/`.input--code`/
        `.input--word` (cream caret `--accent`, `--surface` fill, amber focus),
        `.field`, `.stack`, `.divider` (amber hairline), `.chip-btn`,
        `.chooser`.
      - **Teams/lobby:** `.teams`/`.team-card`/`.team-card--on` (top accent bar
        in team color, no left bar), `.pill--team` (team color), `.room-code`
        (Anton amber).
      - **Standings (scoreboard):** `.standings`/`.standing` color-block rows;
        `.standing--you` amber top bar; `.standing__rank` Anton tabular-nums;
        `.standing__name`/`.tag` variants (recolor `.tag--team` to team color,
        `.tag--away` muted); `.make-host` amber; scores Anton.
      - **Countdown fixture:** `.countdown`/`.countdown__value` (Anton,
        tabular-nums, surface panel feel); `.countdown--urgent` → coral pulse
        (the one repeating motion).
      - **Picking keyboard:** `.keyboard`/`.key` (cream? no — keys are
        `--surface-2`; selected `.key--on` = `--tap` with amber/tap glow
        recolored from `rgba(255,235,59,*)` to `rgba(255,210,63,*)`); keep
        `key-pop`; `.tally`; `.locked`.
      - **Value table / tiles:** `.value-table`/`.value-row`; `.value-letter`
        (cream 3D tile: `--tile`/`--tile-ink`, offset+blur shadow + top
        highlight, 10px radius); `.chips`/`.chip`; `.rare` (amber border, cream
        tile).
      - **Word making:** `.composer`, `.feedback--ok/--bad` (good/coral
        tints), `.scoreline`, `.wordlist li` (color-block rows, amber points
        tabular-nums).
      - **Review (hero motion):** `.reveal` (color-block panel), `.reveal__word`
        (Anton, pop-in is the hero motion), `.reveal__who` (Hanken muted),
        `.spotlight*`, `.myround` (recolor old purple `rgba(103,58,183,*)` →
        amber `rgba(244,165,54,*)`); `.unique-groups`/`.unique-group`.
      - **How to play:** `.rules-link`, `.app--rules`, `.rules`/`.rules__title`
        (Anton), `.rules__section`/`.rules__num`/`.rules__list`, `.slides`/
        `.slide`/`.slides__nav`/`.slides__dot` (amber active dot), `.chooser`.
      - **Final results / winner figure / confetti:** restyle all
        `.winner-figure__*` per §2; `.confetti__piece` uses `--color` (set in
        TSX to the palette set); `.standing__celebrate`. Keep all animation
        class names (`--intro`/`--static`/`--pop`).
      - **Motion keyframes:** keep `rise`, `pop-in`, `drop-in`, `bounce-in`,
        `shake`, `glow-in`, `soft-pulse`, `key-pop`, `pulse-ready`, and ALL
        winner-figure/medal/cup/sparkle/confetti keyframes; recolor
        `rgba(255,235,59,*)` → amber/tap `rgba(255,210,63,*)` or
        `rgba(244,165,54,*)`. Keep the `prefers-reduced-motion` block. Per
        DESIGN "one authored moment": keep screen-entry rise and per-list
        staggered rises (pre-existing), keep reveal-word pop-in as hero, keep
        countdown-urgent pulse as the repeating motion — do NOT add new uniform
        section rises.
      - **Consent banner:** `.consent*` — keep position (fixed bottom center)
        and behavior; recolor to palette (`--surface` panel, `--tap` primary
        button, `--ink` text, `--accent` focus).
      Files: `client-play/src/styles.css`.
      Verify: `npm.cmd run build` (play workspace) succeeds; `npx vitest run`
      (play workspace) — `Scoreboard.test.tsx` + `finalRanks.test.ts` pass.

- [ ] 3. **Rewrite `client-tv/src/styles.css` fully (token block + every
      component rule) to the Game Show Set, consistent with the phone.** Same
      `:root` token block as §1. Set body to Hanken; Anton for display. TV is
      wide with `clamp()` fluid type (keep existing clamp scales). Restyle:
      - **Shell:** `.tv`, `.tv-topbar` (amber wordmark `.tv-brand` as lit amber
        sign), `.tv-topbar__code`, `.tv-pill`/`.tv-pill--phase` (solid pill),
        `.tv-content`; `.tv-watermark` (big translucent Anton clock,
        tabular-nums; urgent → coral pulse `tv-watermark-pulse` recolored).
      - **Warbar (team battle):** `.tv-warbar`/`.tv-warbar__seg--A/B/C/D` → team
        colors (A amber, B coral, C teal-cyan, D cream); `.tv-warbar__track`
        `--line`; `.tv-warbar__score` tabular-nums; `border-right` 1px divider
        recolor to teal-tinted `rgba(26,88,104,*)`.
      - **Countdown fixture:** `.tv-countdown`/`.tv-countdown__value` (Anton,
        tabular-nums); `.tv-countdown--urgent` coral pulse.
      - **Entry:** `.tv-entry__input` (cream caret, amber focus), `.tv-btn`,
        `.tv-error` (coral).
      - **Lobby:** `.tv-lobby__code`/`.tv-code` (Anton amber), `.tv-lobby__url`,
        `.tv-namelist li`, `.tv-tag`/`.tv-tag--away`, `.tv-lobby__teams`/
        `.tv-lobby__team` (top team-color accent bar).
      - **Picking:** `.tv-tally`, `.tv-picks`, `.tv-pick` — **remove
        `border-left:6px`**, replace with a **top accent bar** (e.g.
        `border-top: 4px solid var(--line)`; locked → `--good`). `.tv-pick__name`
        (Anton), `.tv-pick__count` (Anton tabular-nums), `.tv-pick__bar`/
        `.tv-pick__bar-fill`.
      - **Teams (BAN inset-left → top):** `.tv-team--A/B/C/D` change
        `box-shadow: inset 6px 0 0 <color>` → `inset 0 6px 0 0 <teamcolor>`
        (full-width top accent bar, keep team color ID). Applies to picks,
        standings, podium.
      - **Value table / tiles:** `.tv-values`/`.tv-value` (color-block);
        `.tv-value__letter` cream 3D tile (`--tile`/`--tile-ink`, offset+blur
        shadow + top highlight, 10px radius; keep the existing inset-bottom
        shadow and extend it); `.tv-empty`/`.tv-total`.
      - **Writing:** `.tv-writers`/`.tv-writer`/`.tv-writer__count` (Anton
        amber tabular-nums).
      - **Words board / live feed:** `.tv-workspace`, `.tv-board`,
        `.tv-feed` (**custom scrollbar** themed), `.tv-feed__item`/
        `--new`/`--big` (amber highlights), `.tv-feed__word` (Anton amber),
        `.tv-feed__points` (good), `.tv-feed__streak` (coral, recolor
        `#ff5722`→`--hot`), `.tv-feed__tag`.
      - **Notice:** `.tv-notice` (Anton).
      - **Review (hero motion):** `.tv-dots`/`.tv-dot`/`--on` (amber glow
        recolored), `.tv-reveal` (color-block panel), `.tv-reveal__word` (Anton,
        pop-in hero), `.tv-reveal__who`/`__points`/`__sub`, `.tv-reveal__rare`
        (cream 3D tile); `.tv-spotlight*` (amber-tinted rows).
      - **Standings (scoreboard):** `.tv-standings`/`.tv-standing` color-block;
        `.tv-standing--leader` (crown + amber treatment, no left bar);
        `.tv-crown` (amber, drop-shadow recolored); `.tv-standing__rank`/
        `__name`/`__score` (Anton tabular-nums), `.tv-standing__move--up/down`
        (good/coral), `.tv-standing__members`, `.tv-team-tag--A/B/C/D` (team
        color tints).
      - **Podium (architectural):** `.tv-podium-wrap`/`.tv-podium`/
        `.tv-podium__col--1/2/3` (varying bar heights = architecture; recolor
        `--1` border `rgba(255,235,59,*)` → `rgba(255,210,63,*)`); medals per §2;
        `.tv-podium__name` (Anton), `.tv-podium__score` (Anton amber),
        `.tv-podium__bar` (amber-tinted gradient recolored); `.tv-confetti`
        (uses `--c` from TSX palette set).
      - **Rules / how to play:** `.tv-link`, `.tv-rules`/`.tv-rules__title`
        (Anton), `.tv-rules__card` (color-block), `.tv-rules__list`/
        `.tv-rules__item` (amber markers), `.tv-slides`/`.tv-slide`/
        `.tv-slides__nav`/`.tv-slides__dot`/`.tv-slides__count`.
      - **Unique words / rare letter:** `.tv-unique*`, `.tv-rare` (amber
        border, cream 3D tile `.tv-rare__letter`).
      - **Motion keyframes:** keep `tv-rise`, `tv-pop`, `tv-pulse`,
        `tv-urgent`, `tv-watermark-pulse`, `tv-glow`, `tv-confetti-fall`; recolor
        all `rgba(255,235,59,*)`/`rgba(255,87,34,*)`/`rgba(103,58,183,*)` →
        amber/coral/teal per role. Keep the `prefers-reduced-motion` block.
      - **Consent banner:** recolor to palette, keep position + behavior.
      Files: `client-tv/src/styles.css`.
      Verify: `npm.cmd run build` (tv workspace) succeeds.

- [ ] 4. **Phone TSX fixes — remove `.eyebrow`/`.subhead`, remap SVG/confetti
      colors. Markup/structure + styling only; no logic/state/handler changes.**
      Files: `client-play/src/screens/Review.tsx`, `screens/Lobby.tsx`,
      `screens/Scoreboard.tsx`, `FinalCelebration.tsx`.
      - `screens/Lobby.tsx`: remove `className="subhead"` from all 4 `<h3>`s
        (Players, Teams, Round length, Rounds); they become plain headings
        carrying their own weight (the `.count` span stays). (CSS `.subhead`
        rule deleted in step 2.)
      - `screens/Review.tsx` — remove the 9 `.eyebrow` usages per this table:
        * Top `<p className="eyebrow">{formatRound(...)}</p>`: **delete** (round
          already shows in the topbar `PhasePill`).
        * `rare_letter` step: delete the eyebrow `<p>`; prepend
          `Rare letter{awarded? · +value}` to the existing `.reveal__who` line
          (so the label sits under the display letter, not as a kicker above).
        * `unique_words`: delete eyebrow; prepend `Unique words · ` to the
          existing `.reveal__who` ("words only these players found").
        * `most_used_word`: delete eyebrow; prepend `Most used word · ` to
          `.reveal__who`.
        * `stat`: delete eyebrow; prepend `{label} · +{points} · ` to
          `.reveal__who`.
        * `draft_penalty`: delete eyebrow; prepend `Draft penalty · ` to
          `.reveal__who`.
        * `spotlight`: delete eyebrow; prepend `Spotlight — ` to `.reveal__who`.
        * `standings` step: replace `<p className="eyebrow">Standings</p>` with
          `<h3 className="reveal__title">Standings</h3>` (new class; add CSS in
          step 2).
      - `screens/Scoreboard.tsx`: `CONFETTI_COLORS` →
        `['#F4A536','#E8435A','#4ECDC4','#F5EFE3','#FFD23F']` (matches TV for
        consistency). Do not touch `WinnerFigure`/`Medal`/`Standings` usage or
        any class names (Scoreboard.test depends on them).
      - `FinalCelebration.tsx`: **no TSX color changes needed for the figure**
        (all figure colors are CSS classes, restyled in step 2). Keep
        `MEDAL_TONES` silver/bronze as-is. (Only the CSS ribbon stroke changes.)
      Verify: `npm.cmd run typecheck` (zero errors); `npx vitest run` —
      `Scoreboard.test.tsx` still passes (it asserts the kept class names +
      aria-labels, which are unchanged).

- [ ] 5. **TV TSX fixes — remove `.tv-eyebrow`, fix border-left/inset, remap
      SVG/QR/confetti colors. Markup/structure + styling only.**
      Files: `client-tv/src/screens/Review.tsx`, `screens/Results.tsx`,
      `screens/Lobby.tsx`, `screens/ValueTable.tsx`, `App.tsx`.
      - `screens/Review.tsx` — remove `.tv-eyebrow` per table:
        * Header `<p className="tv-eyebrow">{formatRound(...)}</p>` above
          `<h2>Review</h2>`: **delete** (round is in the topbar `tv-pill`).
        * `rare_letter`: delete eyebrow; prepend `Rare letter · ` to
          `.tv-reveal__who`.
        * `unique_words`: replace `<p className="tv-eyebrow">Words only one
          player found</p>` with `<h3 className="tv-reveal__title">Words only
          one player found</h3>` (new class; add CSS in step 3).
        * `most_used_word`: delete eyebrow; add a new
          `<p className="tv-reveal__who">Found by the most players</p>` below
          the `.tv-reveal__word` (reuse existing class).
        * `stat`: delete eyebrow; prepend `+{points} points · ` to
          `.tv-reveal__who`.
        * `draft_penalty`: delete eyebrow; prepend `Draft penalty · ` to
          `.tv-reveal__who`.
        * `spotlight`: delete eyebrow; prepend `Spotlight — ` to
          `.tv-reveal__sub`.
        * `leaderboard` step: no eyebrow (returns `<Standings/>`); unchanged.
      - `screens/Results.tsx`: delete BOTH header
        `<p className="tv-eyebrow">{formatRound(...)}</p>` (round in topbar);
        `<h2>Final results</h2>` / `<h2>Round {n} results</h2>` stay. Recolor
        `CONFETTI_COLORS` → `['#F4A536','#E8435A','#4ECDC4','#F5EFE3','#FFD23F']`.
        Keep `.tv-podium`/`.tv-podium__col`/`.tv-confetti` structure (e2e asserts
        counts).
      - `screens/Lobby.tsx`: replace
        `<p className="tv-eyebrow">Grab your phone and join</p>` with
        `<h3 className="tv-lobby__title">Grab your phone and join</h3>`;
        replace `<p className="tv-eyebrow">Players <span className="tv-count">
        {n}</span></p>` with `<h3 className="tv-lobby__title">Players <span
        className="tv-count">{n}</span></h3>` (keep `.tv-count`).
        Recolor the QR: `QRCodeSVG bgColor="#0b0f1a"` → `"#144A59"`,
        `fgColor="#ffd166"` → `"#F5EFE3"` (cream on teal = scannable).
      - `screens/ValueTable.tsx`: replace
        `<p className="tv-eyebrow">Just accepted</p>` with
        `<h3 className="tv-feed__title">Just accepted</h3>`.
      - `App.tsx`: **delete** the NOTICE `<p className="tv-eyebrow">Heads up
        </p>` (the phase pill in the topbar already shows "Heads up" for
        NOTICE); `<p className="tv-notice">{state.notice}</p>` stays.
      - No TSX change needed for the border-left/inset fix — that is CSS-only
        (step 3). Verify the team-color top bars render by spot-checking the
        built output is not required; build + typecheck suffice.
      Verify: `npm.cmd run typecheck` (zero errors); `npm.cmd run build`
      succeeds.

- [ ] 6. **Browser surfaces + tabular-nums verification (both stylesheets).**
      Ensure, in both `styles.css`: `::selection` themed (amber bg / ink);
      `caret-color: var(--accent)` on `.input`/`.input--word`/`.input--code`/
      `.tv-entry__input`; custom `::-webkit-scrollbar`/`scrollbar-*` on
      `.tv-feed` and the phone scroll container; focus rings use `--accent`;
      link underline offset present (`.rules-link`, `.tv-link`); and
      `font-variant-numeric: tabular-nums` present on every score/count/timer:
      `.countdown__value`, `.standing__rank`/`__score`, `.tv-watermark__value`,
      `.tv-warbar__score`, `.tv-pick__count`, `.tv-writer__count`,
      `.tv-standing__rank`/`__score`/`__move`, `.tv-podium__medal`/`__score`,
      `.tv-countdown__value`, `.tv-spotlight__points`, `.rules__count`,
      `.tv-slides__count`, `.count`/`.tv-count`. Add `tabular-nums` to any new
      numeric element introduced (e.g. `.reveal__title` if it ever shows a
      number — it won't). Keep the `prefers-reduced-motion` guards.
      Files: `client-play/src/styles.css`, `client-tv/src/styles.css`.
      Verify: `grep -n "tabular-nums"` in both files shows the score/count/timer
      rules; `npm.cmd run build` succeeds.

- [ ] 7. **Class-reference sync + cleanup.** Grep each client's `src/` for:
      (a) CSS classes used in TSX but missing in CSS (orphans) — add or remove;
      (b) CSS classes defined but unused (dead) — remove if introduced by this
      work (e.g. ensure `.eyebrow`/`.subhead`/`.tv-eyebrow` are gone from BOTH
      CSS and TSX; ensure the 4 new `__title` classes exist in both). Confirm
      the value-tier classes `value-1..5` (phone) and `lv-1..5` (TV) are still
      no-op (currently undefined in CSS — leave as-is; do NOT add styling that
      breaks the cream-tile rule unless intentional, in which case keep all
      tiles cream per DESIGN). Confirm no remaining old-palette hex in TSX
      (`#673AB7`/`#FF5722`/`#FFEB3B`/`#ffd166`/`#0b0f1a` etc.) except the kept
      phone `MEDAL_TONES` silver/bronze.
      Files: both `src/` trees, both `styles.css`.
      Verify: `grep -rn "eyebrow\|subhead\|tv-eyebrow"` across both `src/`
      returns nothing; `grep -rn "#673AB7\|#FF5722\|#FFEB3B\|#ffd166\|#0b0f1a"`
      in `*.tsx` returns nothing except `MEDAL_TONES`.

- [ ] 8. **Final verification (Windows; from repo root).**
      Run, in order, and require all green:
      - `npm.cmd run typecheck` — zero errors across all workspaces.
      - `npm.cmd run build` — succeeds; `dist/` produced for play + tv
        (and server/shared as applicable).
      - `npm.cmd test` — scoring + server units pass; phone
        `Scoreboard.test.tsx` passes; `finalRanks.test.ts` passes.
      - Do NOT run Playwright e2e (`npm.cmd run e2e --workspace
        @wordt/client-play`); confirm by inspection that no e2e-asserted class
        or button text (§3 Frozen) was renamed/removed/changed.
      Files: whole repo.
      Verify: all three commands green; both clients render one consistent
      game-show-set world (deep teal ground, amber sign wordmark, cream 3D
      tiles, Anton display, color-block panels, countdown fixture, scoreboard
      standings, architectural podium; no eyebrow/kicker above headings; no
      thick colored border-left/right; all SVG/inline colors on palette).

---

## Notes on DESIGN.md not fully spelled out in the brief

- **Radius scale is fixed** (20/14/10) — apply consistently; the old `--radius:
  14px` single value is replaced by the three-tier scale.
- **Spacing rule** ("tight groups, generous separation, more space above a
  heading than below") — apply to heading margins in both rewrites.
- **Motion discipline** — the existing per-section `rise` is pre-existing and
  acceptable as screen-entry; do not ADD uniform rises to new sections. The
  reveal word pop-in is the hero; countdown-urgent pulse is the only repeating
  motion. Reduced-motion guard stays.
- **No gradient text, no glass decoration, no monospace costume** — do not
  introduce any.
- **Cream tiles are the central object** — `--tile`/`--tile-ink` kept; restyle
  to 3D (offset+blur, top highlight), do not change their role or the game
  logic around them.
