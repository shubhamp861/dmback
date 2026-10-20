export type KeywordMatchMode = 'contains' | 'exact' | 'starts_with' | 'regex';

export interface KeywordRule {
  value: string;
  mode?: KeywordMatchMode;
  caseSensitive?: boolean;
}

export interface KeywordMatch {
  matched: boolean;
  keyword?: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchKeywords(text: string, rules: readonly KeywordRule[]): KeywordMatch {
  for (const rule of rules) {
    const mode = rule.mode ?? 'contains';
    const source = rule.caseSensitive ? text : normalize(text);
    const value = rule.caseSensitive ? rule.value : normalize(rule.value);

    // Punctuation/symbol-only rules become empty after normalization. They
    // must not match every comment through String.includes('').
    if (mode !== 'regex' && !value) {
      continue;
    }

    let matched = false;
    switch (mode) {
      case 'exact':
        matched = source === value;
        break;
      case 'starts_with':
        matched = source.startsWith(value);
        break;
      case 'regex':
        try {
          matched = new RegExp(rule.value, rule.caseSensitive ? '' : 'i').test(text);
        } catch {
          matched = false;
        }
        break;
      case 'contains':
        matched = source.includes(value);
        break;
    }

    if (matched) {
      return { matched: true, keyword: rule.value };
    }
  }

  return { matched: false };
}

export function matchesExclusion(text: string, exclusions: readonly KeywordRule[] = []): boolean {
  return matchKeywords(text, exclusions).matched;
}
