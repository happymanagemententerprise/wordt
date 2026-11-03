---
name: Wordt
description: A shared word tournament with a phone controller and a TV arena.
colors:
  primary: "#E4FF1A"
  secondary: "#B1E4E3"
  tertiary: "#E4FFE6"
  stormy-teal: "#127475"
  shadow-grey: "#272838"
  mint-text-tint: "#C7F2F1"
typography:
  display:
    fontFamily: "Barlow Condensed, Impact, sans-serif"
    fontWeight: 700
    lineHeight: 0.95
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
spacing:
  screen: "clamp(16px, 3vw, 52px)"
  group: "16px"
  compact: "8px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.shadow-grey}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.shadow-grey}"
    rounded: "{rounded.md}"
---

# Design System: Wordt

## Overview

**Creative North Star: “The Living-Room Arcade”**

Wordt is a living-room word tournament. The phone is the player’s controller; the TV is the shared, display-only arena. Both clients use the same visual language at different scales: quick, reachable choices on the phone and stable, couch-distance information on the TV.

The five user-selected colors are neon chartreuse (`#E4FF1A`), icy aqua (`#B1E4E3`), frosted mint (`#E4FFE6`), stormy teal (`#127475`), and shadow grey (`#272838`). Mint text tint (`#C7F2F1`) is derived from icy aqua for supporting text on teal surfaces; it is not an additional selected palette color. Barlow Condensed carries display moments; Barlow carries controls and supporting copy.

## Colors

- **Primary — Neon Chartreuse:** actions, active selections, and meaningful game events.
- **Secondary — Icy Aqua:** focus, secondary interaction, boundaries, and teammate identity.
- **Tertiary — Frosted Mint:** readable text and letter tile surfaces.
- **Stormy Teal:** grouped game surfaces and panels.
- **Shadow Grey:** page ground and lettering on bright controls or tiles.
- **Derived mint text tint:** supporting text on teal where icy aqua is not the chosen text treatment.

Color always accompanies clear state wording or structure. Chartreuse is reserved for action and meaningful game signals.

## Typography

**Display:** Barlow Condensed, weight 700, with Impact and sans-serif fallbacks. Used for titles, room codes, scores, timers, and phase headings.

**Body and controls:** Barlow, with system-ui and sans-serif fallbacks. Used for instructions, labels, controls, and supporting copy. Numeric status and score displays use tabular figures where applied.

## Layout

The phone (`client-play`) is a narrow, safe-area-aware controller for room setup, lobby, play, review, results, and rules. Its primary actions and game controls remain easy to reach. The TV (`client-tv`) presents room entry, lobby, active game phases, review, standings, results, and rules as a display-only arena. It gives room code, phase, timer, activity, and standings a stable large-scale reading order. Room entry and lobby layouts adapt to narrower displays.

Each shared `styles.css` loads before its client’s `arcade.css`; the arcade layer supplies the final palette, typography, focus treatment, surfaces, and responsive details.

## Elevation & Depth

Stormy teal separates game panels from the shadow-grey ground. The TV lobby panel, board, and feed use restrained shadows; letter tiles use a soft offset shadow for tactile separation. Keep depth subordinate to game information.

## Shapes

Small tags and status elements use compact corners; controls and tiles use medium corners; major TV panels use the larger corner size. The clients use 8–16px corner radii according to component scale.

## Components

- **Phone primary and ready actions:** `.btn--primary` and `.btn--ready` use chartreuse with shadow-grey text. `.btn--ghost` remains transparent with readable text.
- **TV room-entry action:** `.tv-btn` is a large chartreuse action; `.tv-link` uses icy aqua.
- **Inputs:** `.input` and `.tv-entry__input` use stormy teal, frosted-mint text, icy-aqua borders and focus rings. Room-code fields use Barlow Condensed.
- **Selection and phase:** `.chooser__tab--on`, `.key--on`, `.chip-btn--on`, and phase pills use chartreuse. Teammate keys use icy aqua.
- **Game surfaces:** standings, team cards, word lists, scorelines, boards, feeds, picks, and value areas use stormy teal with icy-aqua boundaries. Letter tiles use frosted mint with shadow-grey lettering.
- **Supporting text and alerts:** supporting copy uses the derived mint tint; error and urgent states use icy aqua and retain their accompanying labels.

## Do's and Don'ts

- Do reserve chartreuse for the next action, active selection, or meaningful game event.
- Do keep phone controls reachable and TV information readable at couch distance.
- Do keep keyboard focus visible with an icy-aqua outline and pair color with explicit state information.
- Do honor reduced-motion preferences.
- Don’t use chartreuse as body text on light surfaces.
- Don’t alter game rules, outcomes, room behavior, or server authority through visual styling.
- Don’t introduce extra palette colors, gradients, or glass effects that compete with game information.
