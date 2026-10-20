import { describe, expect, it } from 'vitest';
import { matchKeywords, matchesExclusion } from '../src/domain/keyword-matcher.js';

describe('matchKeywords', () => {
  it.each([
    ['GUIDE please', { value: 'guide', mode: 'contains' as const }, true],
    ['Guide now', { value: 'guide', mode: 'exact' as const }, false],
    ['guide', { value: 'guide', mode: 'exact' as const }, true],
    ['guide to growth', { value: 'guide', mode: 'starts_with' as const }, true],
    ['send me a pdf', { value: '^send me', mode: 'regex' as const }, true]
  ])('matches %s using %s', (text, rule, expected) => {
    expect(matchKeywords(text, [rule]).matched).toBe(expected);
  });

  it('normalizes punctuation, spacing, and case', () => {
    expect(matchKeywords('  GUIDE!!!   please ', [{ value: 'guide please' }])).toEqual({
      matched: true,
      keyword: 'guide please'
    });
  });

  it('does not let an invalid regular expression crash matching', () => {
    expect(matchKeywords('hello', [{ value: '[', mode: 'regex' }]).matched).toBe(false);
  });

  it('ignores symbol-only rules after normalization', () => {
    expect(matchKeywords('hello', [{ value: '!!!' }]).matched).toBe(false);
  });
});

describe('matchesExclusion', () => {
  it('detects an excluded phrase', () => {
    expect(matchesExclusion('this is spam', [{ value: 'spam' }])).toBe(true);
  });
});
