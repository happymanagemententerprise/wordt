import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { LetterValueTable } from '@wordt/shared';

import { LetterChips, ValueTable } from './ui';

const table = {
  entries: [
    { letter: 'A', count: 1, value: 1 },
    { letter: 'Z', count: 0, value: 10 },
  ],
  values: { A: 1, Z: 10 },
  counts: { A: 1, Z: 0 },
  source: { A: 'overlap', Z: 'added' },
} as LetterValueTable;

describe('picked-letter glow', () => {
  it('glows only the letters this player picked in the value table', () => {
    const { container } = render(<ValueTable table={table} mine={['A']} />);

    expect(container.querySelectorAll('.value-row--mine')).toHaveLength(1);
    expect(container.querySelector('.value-row--mine')?.textContent).toContain('A');
    expect(container.querySelector('.value-row--mine')?.textContent).toContain('yours');
    expect(container.querySelector('.value-letter--mine')).toBeTruthy();
  });

  it('glows picked letters in the word-phase chips too', () => {
    const { container } = render(<LetterChips table={table} mine={['Z']} />);

    expect(container.querySelectorAll('.chip--mine')).toHaveLength(1);
    expect(container.querySelector('.chip--mine')?.textContent).toContain('Z');
  });
});
