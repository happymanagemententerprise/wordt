import { describe, expect, it } from 'vitest';

import { teamIdsForPlayerCount } from '../src/teams';

describe('teamIdsForPlayerCount', () => {
  it('splits every player count into teams of two, never fewer than two teams', () => {
    expect(teamIdsForPlayerCount(2)).toEqual(['A', 'B']);
    expect(teamIdsForPlayerCount(3)).toEqual(['A', 'B']);
    expect(teamIdsForPlayerCount(4)).toEqual(['A', 'B']);
    expect(teamIdsForPlayerCount(5)).toEqual(['A', 'B', 'C']);
    expect(teamIdsForPlayerCount(6)).toEqual(['A', 'B', 'C']);
    expect(teamIdsForPlayerCount(7)).toEqual(['A', 'B', 'C', 'D']);
    expect(teamIdsForPlayerCount(8)).toEqual(['A', 'B', 'C', 'D']);
  });
});