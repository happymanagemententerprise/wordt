# DESIGN — Wordt

## Direction: The Game Show Set

The TV is a lit broadcast studio; the phone is the contestant's buzzer panel.
Saturated color-block set architecture on a deep teal stage, bold condensed
display type, a real countdown clock fixture, scoreboard standings, and a
podium with architectural presence. The old dark-neutral + purple-line Material
look is the anti-reference: replaced, not polished.

The category default this refuses: the flat bright party-game UI (Jackbox /
Kahoot) with rounded color blocks and a punchy sans. This world is a *specific*
era and material — 70s/80s broadcast set design — not the modern flat standard.

## Color strategy: Committed

One saturated ground carries the surface; warm amber is the primary accent doing
real work across both clients. Dark is chosen from the use scene (a dimly lit
room, a TV across the room, phones held under mixed light), not from category.

### Palette

| token | value | role |
|------|-------|------|
| `--bg` | `#0E3A47` | deep teal studio ground (the cyclorama) |
| `--surface` | `#144A59` | elevated teal panel |
| `--surface-2` | `#1A5868` | raised teal (inputs, chips) |
| `--ink` | `#F5EFE3` | warm cream text (studio-lit white) |
| `--muted` | `#8DA8AE` | teal-tinted secondary text (tinted from the hue, never gray) |
| `--accent` | `#F4A536` | mustard amber — primary "lights up" accent: active states, scores, highlights |
| `--accent-ink` | `#1A1206` | dark ink on amber |
| `--hot` | `#E8435A` | coral — secondary accent: selected/active borders, urgency |
| `--tap` | `#FFD23F` | bright amber-yellow — selected letter keys, the "lit" state |
| `--tap-ink` | `#1A1206` | ink on lit keys |
| `--tile` | `#F5EFE3` | cream letter tiles (the game's central object, kept) |
| `--tile-ink` | `#1A1206` | ink on tiles |
| `--good` | `#3DDC97` | valid / accepted |
| `--bad` | `#FF5D6C` | invalid / urgent / error |
| `--line` | `rgba(244, 165, 54, 0.22)` | subtle amber-tinted hairline (replaces the old purple) |

Team colors map to the palette: A `#F4A536` (amber), B `#E8435A` (coral),
C `#4ECDC4` (bright teal-cyan), D `#F5EFE3` (cream).

## Typography

- **Display — Anton** (single ultra-bold condensed weight, Google Fonts): the
  wordmark, phase titles, big reveals, countdown values, podium scores, rank
  numbers, big point totals. Broadcast-signage energy; loads in one file.
- **Body/UI — Hanken Grotesk** (400–800, Google Fonts): labels, body copy,
  buttons, inputs, secondary headings, all UI text. Clean, warm, readable.
- Load both via `<link>` in each client's `index.html`. Set the stack as
  `'Anton', system-ui, sans-serif` for display and `'Hanken Grotesk', system-ui,
  sans-serif` for body.
- No system display face as the voice of the page. No gradient text. No
  monospace costume.

## Form

- **No eyebrow / kicker above a heading.** This is a ban: the heading carries
  its own weight. Fold any label information into the heading or restructure.
  Replace existing `.eyebrow`, `.subhead`, `.tv-eyebrow` usages accordingly.
- **No colored `border-left`/`border-right` above 1px** on cards or list items.
  Replace the current `.tv-pick` 6px left bar and team inset shadows with a
  full-width top accent bar or a surface-elevation change.
- **Color-block panels**, not subtle bordered cards everywhere. Sections are
  stage pieces: a `--surface` panel with generous internal padding, separated by
  stage-floor gap, not hairlines.
- **Tiles** stay cream (`--tile`) with dark ink — the game's central object.
  Give them a real 3D set-piece feel: a soft offset+blur shadow (not a zero-blur
  halo), a subtle top highlight, chunky presence.
- **Spacing:** tight groups, generous separation, more space above a heading
  than below it.
- **Radius scale:** 20px for large set-piece panels, 14px for standard cards and
  buttons, 10px for tiles and chips. Keep it consistent.

## Motion

- **One authored moment per transition**, not a uniform "rise" on every section.
  The reveal sequence (words appearing one at a time during review) is the hero
  motion. The countdown-urgent pulse is the one repeating motion.
- Exponential ease-out from an already-visible default. Reach past transform and
  opacity: blur, clip-path, and shadow belong to the palette when smooth.
- Respect `prefers-reduced-motion`.

## Browser surfaces

Theme from the palette: text `::selection`, the caret color, custom scrollbars
on `.tv-feed` and the word list, focus rings (`--accent`), underline offset on
links, and `font-variant-numeric: tabular-nums` on all scores, counts, and
timers.

## What stays (product truth, untouched)

- All game logic, socket protocol, component behavior, and state flow.
- The cream letter tiles as the central object (color kept, restyled).
- The how-to-play carousel and its images in `public/how-to-play/`.
- Confetti and the winner-figure SVG celebration (restyled to the palette, not
  removed).
- The countdown, standings, podium, spotlight, live feed, and review sequence
  as features — restyled, not restructured.

## Direction contract

**THESIS:** The TV is a broadcast studio set; the phone is the contestant's
buzzer. The category default (flat bright party UI) is refused in favor of a
specific era's set-design material.

**OWN-WORLD:** Deep teal ground, mustard-amber accent, coral urgency, cream
tiles, Anton display + Hanken Grotesk body. Recognizable with all content
removed by the color-block architecture and the condensed signage display.

**STORY:** The player feels like a contestant on a lit stage — the countdown is
a real fixture, the standings are a scoreboard, the reveal is a staged moment,
and the podium is architecture. They pick, they race, they celebrate.

**FIRST VIEWPORT (TV):** the wordmark as a lit amber sign in the studio header,
room code beneath, the phase as a solid pill, the stage floor below with
color-block set pieces. On the phone: the wordmark sign, a bold task heading,
and the controller (keyboard or composer) as the primary action.

**FORM:** Color-block panels on a teal stage; condensed display for impact;
Hanken for everything else; tiles as 3D cream set pieces; no eyebrows, no
border-left bars, no gradient text, no glass decoration.

**HONEST RISK:** Theatrical set design tips to camp if type and spacing aren't
disciplined. Commit without irony; the craft is in the restraint of the glow
and the precision of the type scale.
