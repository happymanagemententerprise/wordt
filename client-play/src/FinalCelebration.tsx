import type { ReactNode } from 'react';

import { prefersReducedMotion } from './finalRanks';

/**
 * Four-point sparkle used on the trophy.
 */
function Sparkle(): ReactNode {
  return (
    <path
      className="winner-figure__sparkle"
      d="M0 -9 L2.1 -2.1 L9 0 L2.1 2.1 L0 9 L-2.1 2.1 L-9 0 L-2.1 -2.1 Z"
    />
  );
}

/**
 * The first-place cartoon: a cheerful figure holding a gold medal on one side
 * and a trophy lifted overhead on the other. Everything is inline SVG so it
 * stays crisp and works offline.
 *
 * The intro is pure CSS, keyed off the `--intro` class: the figure pops in, the
 * medal swings down, the cup lifts with a sparkle, then a gentle idle loop takes
 * over. CSS animations fire once when the element mounts and never replay on a
 * React re-render, so a server state push cannot restart them. Reduced-motion
 * visitors get the resting (final) pose with no motion at all.
 */
export function WinnerFigure(): ReactNode {
  const reduced = prefersReducedMotion();
  const className = `winner-figure${reduced ? ' winner-figure--static' : ' winner-figure--intro'}`;

  return (
    <svg
      className={className}
      viewBox="0 0 150 156"
      role="img"
      aria-label="First place champion holding a gold medal and a trophy"
      focusable="false"
    >
      <g className="winner-figure__idle">
        <ellipse className="winner-figure__shadow" cx="75" cy="149" rx="36" ry="6" />

        <rect className="winner-figure__leg" x="62" y="103" width="11" height="32" rx="5.5" />
        <rect className="winner-figure__leg" x="77" y="103" width="11" height="32" rx="5.5" />
        <rect className="winner-figure__shoe" x="58" y="131" width="18" height="10" rx="5" />
        <rect className="winner-figure__shoe" x="74" y="131" width="18" height="10" rx="5" />

        <rect className="winner-figure__body" x="53" y="63" width="44" height="51" rx="20" />

        <path className="winner-figure__arm" d="M64 78 L48 54" />
        <path className="winner-figure__arm" d="M86 78 L104 60" />

        <g className="winner-figure__head">
          <circle className="winner-figure__skin" cx="75" cy="44" r="25" />
          <path
            className="winner-figure__hair"
            d="M50 44 a25 25 0 0 1 50 0 c-5 -9 -12 -13 -25 -13 s-20 4 -25 13 z"
          />
          <circle className="winner-figure__eye" cx="66" cy="45" r="3.2" />
          <circle className="winner-figure__eye" cx="84" cy="45" r="3.2" />
          <circle className="winner-figure__cheek" cx="58" cy="53" r="4" />
          <circle className="winner-figure__cheek" cx="92" cy="53" r="4" />
          <path className="winner-figure__smile" d="M66 54 q9 8 18 0" />
        </g>

        <circle className="winner-figure__skin" cx="48" cy="54" r="6" />
        <circle className="winner-figure__skin" cx="104" cy="60" r="6" />

        <g className="winner-figure__medal">
          <path className="winner-figure__ribbon" d="M104 60 L100 78" />
          <path className="winner-figure__ribbon" d="M104 60 L112 78" />
          <circle className="winner-figure__medal-disc" cx="108" cy="87" r="12" />
          <path className="winner-figure__medal-gloss" d="M101 82 a9 9 0 0 1 9 -3 a9 9 0 0 1 5 2" />
          <path
            className="winner-figure__medal-star"
            d="M108 80 l2.3 4.7 5.2 .6 -3.9 3.5 1.1 5.1 -4.7 -2.7 -4.7 2.7 1.1 -5.1 -3.9 -3.5 5.2 -.6 z"
          />
        </g>

        <g className="winner-figure__cup">
          <path className="winner-figure__cup-metal" d="M10 8 h32 v12 c0 9 -7 16 -16 16 s-16 -7 -16 -16 z" />
          <ellipse className="winner-figure__cup-gloss" cx="21" cy="16" rx="3.5" ry="7" />
          <path className="winner-figure__cup-handle" d="M10 12 c-8 3 -8 15 1 17" />
          <path className="winner-figure__cup-handle" d="M42 12 c8 3 8 15 -1 17" />
          <rect className="winner-figure__cup-metal" x="27" y="34" width="6" height="8" />
          <rect className="winner-figure__cup-metal" x="20" y="41" width="20" height="6" rx="3" />
          <g transform="translate(50 4) scale(0.8)">
            <Sparkle />
          </g>
          <g transform="translate(24 -2) scale(0.55)">
            <Sparkle />
          </g>
        </g>
      </g>
    </svg>
  );
}

const MEDAL_TONES = {
  silver: { fill: '#C7CFDA', gloss: '#EEF1F5', ring: '#8F99A6' },
  bronze: { fill: '#CD7F32', gloss: '#E8B27A', ring: '#8C4E1E' },
} as const;

/**
 * A quiet silver or bronze medal for second and third place. Much smaller and
 * softer than the first-place figure — a fast pop-in and nothing else.
 */
export function Medal({ kind }: { kind: 'silver' | 'bronze' }): ReactNode {
  const tone = MEDAL_TONES[kind];
  const reduced = prefersReducedMotion();
  const className = `standing-medal${reduced ? ' standing-medal--static' : ' standing-medal--pop'}`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 32"
      role="img"
      aria-label={kind === 'silver' ? 'Silver medal' : 'Bronze medal'}
      focusable="false"
    >
      <path className="standing-medal__ribbon" d="M6 2 L12 12 L18 2" />
      <path className="standing-medal__ribbon" d="M6 2 L10 2 L13 12 L9 13 Z" />
      <circle className="standing-medal__disc" cx="12" cy="21" r="9" fill={tone.fill} />
      <path className="standing-medal__gloss" d="M6 18 a7 7 0 0 1 6 -3" stroke={tone.gloss} />
      <circle
        className="standing-medal__ring"
        cx="12"
        cy="21"
        r="5.5"
        fill="none"
        stroke={tone.ring}
      />
    </svg>
  );
}

export type { MedalKind } from './finalRanks';
