/** Browser-safe "how to play" content shared by both clients. */

export interface RulesSection {
  heading: string;
  intro?: string;
  steps?: string[];
  bullets?: string[];
}

export const HOW_TO_PLAY: readonly RulesSection[] = [
  {
    heading: 'The point',
    intro: 'Everyone picks letters together, then races to make the best words from the pool the room agreed on.',
    bullets: [
      'Letters picked by two or more players enter the round\u2019s pool.',
      'The computer tops the pool up to 15 letters.',
      'Score the most points before the timer runs out.',
    ],
  },
  {
    heading: 'Pick letters',
    steps: [
      'Pick a share of the alphabet \u2014 15 letters for two players, 10 for three or more.',
      'Letters two or more players picked become the pool; the computer fills the rest.',
      'Lock in your pick when you\u2019re happy.',
    ],
  },
  {
    heading: 'Read the values',
    bullets: [
      'Rarer pool letters are worth more, ranked into five tiers (1–5).',
      'Vowels rank on their own, so they stay cheap (1–2).',
      'Computer-added letters sit at their standard Scrabble value.',
      'A word scores the sum of its letter values.',
    ],
  },
  {
    heading: 'The rare letter',
    bullets: [
      'Each game draws one rare consonant (never a vowel, weighted towards Q/X/J/Z). It stays the same for every round and can never be in the pool or any pick.',
      'Your first valid word that contains it spends your one lifetime use for that game. Later attempts are rejected.',
      'If two or more players submit the identical rare word this round, that word nets to zero for them and nobody gets +10. Different rare words each keep the +10.',
      'The rare letter never counts toward a word\'s normal tile value.',
    ],
  },
  {
    heading: 'Make words',
    bullets: [
      'Words need at least 3 letters and must be real dictionary words.',
      'Letters can be reused across words.',
      'Submit as many words as you can before the round ends.',
      'A wrong try counts against your accuracy; a duplicate is a no-op.',
    ],
  },
  {
    heading: 'Score the round',
    bullets: [
      '+2 for every unique word \u2014 the only person to find it.',
      '+2 for the most unique words, the most words, the longest word, and the highest-scoring word.',
      '+1 for the best accuracy.',
      '\u22121 for each letter you picked but never used in a word (the draft penalty).',
      'If everyone finds the same word, it scores nothing.',
    ],
  },
  {
    heading: 'Teams (optional)',
    bullets: [
      'The host can switch teams on in the lobby \u2014 teams of two, up to four teams.',
      'Teammates share 10 letters (5 each) and can\u2019t grab the same letter.',
      'A team scores as one player; the review credits whoever found each word.',
    ],
  },
  {
    heading: 'The winner',
    bullets: [
      'Three rounds per game; the host picks how long each round lasts.',
      'The pool and the letter values change every round.',
      'The highest total on the final leaderboard wins \u2014 ties are shared.',
    ],
  },
];