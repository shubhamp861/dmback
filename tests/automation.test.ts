import { describe, expect, it } from 'vitest';
import { automationInputSchema, evaluateComment } from '../src/domain/automation.js';

const automation = {
  id: 'automation-1',
  igAccountId: 'account-1',
  status: 'live' as const,
  keywordRules: [{ value: 'guide' }],
  exclusions: [{ value: 'spam' }]
};

describe('evaluateComment', () => {
  it('queues a matching comment', () => {
    expect(evaluateComment(automation, 'Can I get the GUIDE?')).toEqual({
      outcome: 'queued',
      matchedKeyword: 'guide'
    });
  });

  it('stores a reason for an excluded comment', () => {
    expect(evaluateComment(automation, 'guide spam')).toEqual({
      outcome: 'skipped',
      reasonCode: 'EXCLUDED_WORD'
    });
  });

  it('stores a reason for a non-match', () => {
    expect(evaluateComment(automation, 'hello there')).toEqual({
      outcome: 'skipped',
      reasonCode: 'NO_KEYWORD_MATCH'
    });
  });
});

describe('automationInputSchema', () => {
  const base = {
    name: 'Guide',
    igAccountId: '33333333-3333-4333-8333-333333333333',
    keywordRules: [{ value: 'guide' }]
  };

  it('allows the full-day schedule ending at hour 24', () => {
    expect(automationInputSchema.safeParse({
      ...base,
      settings: { schedule: { startHour: 0, endHour: 24 } }
    }).success).toBe(true);
  });

  it('rejects schedules whose end is not later than their start', () => {
    expect(automationInputSchema.safeParse({
      ...base,
      settings: { schedule: { startHour: 18, endHour: 18 } }
    }).success).toBe(false);
  });
});
