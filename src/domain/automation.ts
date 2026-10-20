import { z } from 'zod';
import { matchKeywords, matchesExclusion, type KeywordRule } from './keyword-matcher.js';

const scheduleSchema = z.object({
  timezone: z.string().min(1).default('UTC'),
  startHour: z.number().int().min(0).max(23).default(0),
  endHour: z.number().int().min(1).max(24).default(24)
}).refine((schedule) => schedule.endHour > schedule.startHour, {
  message: 'endHour must be later than startHour; overnight schedules are not supported yet',
  path: ['endHour']
});

export const keywordRuleSchema = z.object({
  value: z.string().trim().min(1).max(200),
  mode: z.enum(['contains', 'exact', 'starts_with', 'regex']).default('contains'),
  caseSensitive: z.boolean().default(false)
});

export const automationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  igAccountId: z.string().uuid(),
  trigger: z.object({ type: z.literal('comment') }).default({ type: 'comment' }),
  keywordRules: z.array(keywordRuleSchema).min(1).max(50),
  exclusions: z.array(keywordRuleSchema).max(50).default([]),
  publicReplies: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
  flowId: z.string().uuid().nullable().default(null),
  settings: z.object({
    dailyCap: z.number().int().positive().nullable().default(null),
    schedule: scheduleSchema.default({ timezone: 'UTC', startHour: 0, endHour: 24 })
  }).default({ dailyCap: null, schedule: { timezone: 'UTC', startHour: 0, endHour: 24 } })
});

export type AutomationInput = z.infer<typeof automationInputSchema>;

export interface AutomationForMatching {
  id: string;
  igAccountId: string;
  status: 'draft' | 'live' | 'paused' | 'error';
  keywordRules: KeywordRule[];
  exclusions: KeywordRule[];
}

export type MatchOutcome =
  | { outcome: 'queued'; matchedKeyword: string }
  | { outcome: 'skipped'; reasonCode: 'NO_KEYWORD_MATCH' | 'EXCLUDED_WORD' | 'PAUSED' };

export function evaluateComment(automation: AutomationForMatching, commentText: string): MatchOutcome {
  if (automation.status !== 'live') {
    return { outcome: 'skipped', reasonCode: 'PAUSED' };
  }

  if (matchesExclusion(commentText, automation.exclusions)) {
    return { outcome: 'skipped', reasonCode: 'EXCLUDED_WORD' };
  }

  const match = matchKeywords(commentText, automation.keywordRules);
  if (!match.matched || !match.keyword) {
    return { outcome: 'skipped', reasonCode: 'NO_KEYWORD_MATCH' };
  }

  return { outcome: 'queued', matchedKeyword: match.keyword };
}
