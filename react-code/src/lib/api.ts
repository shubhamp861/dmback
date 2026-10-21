/**
 * LinktoDM API Client and Transport Adapter
 * Conforms strictly to backend contract in API-AUTH-MAPPING_e830a4dd.md
 */

export const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://127.0.0.1:3000'
  : '';

export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  requestId?: string;
};

export type ApiResponse<T> = { data: T };

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type AuthUser = {
  id: string;
  email: string;
  workspaceId: string;
  role: UserRole;
};

export type InstagramAccount = {
  id: string;
  workspaceId: string;
  igUserId: string;
  username: string;
  accountType: string | null;
  profilePictureUrl: string | null;
  permissions: string[];
  status: 'active' | 'needs_reauth' | 'disconnected' | string;
  tokenExpiresAt: string | null;
};

export type KeywordRuleMode = 'contains' | 'exact' | 'starts_with' | 'regex';

export type KeywordRule = {
  value: string;
  mode: KeywordRuleMode;
  caseSensitive: boolean;
};

export type AutomationSettings = {
  exclusions?: KeywordRule[];
  dailyCap: number | null;
  schedule: {
    timezone: string;
    startHour: number;
    endHour: number;
  };
};

// Raw database snake_case representation returned by backend
export type RawAutomationRow = {
  id: string;
  ig_account_id: string;
  name: string;
  status: 'draft' | 'live' | 'paused' | 'error';
  trigger: {
    type: 'comment';
  };
  keyword_rules: KeywordRule[];
  public_replies: string[];
  flow_id: string | null;
  settings: {
    exclusions?: KeywordRule[];
    dailyCap: number | null;
    schedule: {
      timezone: string;
      startHour: number;
      endHour: number;
    };
  };
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Normalized frontend automation type
export type Automation = {
  id: string;
  igAccountId: string;
  name: string;
  status: 'draft' | 'live' | 'paused' | 'error';
  trigger: { type: 'comment' };
  keywordRules: KeywordRule[];
  exclusions: KeywordRule[];
  publicReplies: string[];
  flowId: string | null;
  settings: AutomationSettings;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TriggerEvent = {
  id: string;
  ig_account_id: string;
  automation_id: string;
  comment_id: string;
  comment_text: string | null;
  matched_keyword: string | null;
  outcome: 'sent' | 'skipped' | 'failed' | 'queued';
  reason_code: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
};

export type AutomationCreateInput = {
  name: string;
  igAccountId: string;
  trigger?: { type: 'comment' };
  keywordRules: KeywordRule[];
  exclusions?: KeywordRule[];
  publicReplies?: string[];
  flowId?: string | null;
  settings?: AutomationSettings;
};

export type ReplayResponse = {
  id: string;
  webhookEventId: string;
  status: 'pending';
};

// Cookie helper
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function csrfHeaders(): HeadersInit {
  const token = readCookie('csrf_token') || '';
  return {
    'x-csrf-token': token,
  };
}

// Normalize backend snake_case row to frontend camelCase model
export function normalizeAutomation(row: RawAutomationRow): Automation {
  return {
    id: row.id,
    igAccountId: row.ig_account_id,
    name: row.name,
    status: row.status,
    trigger: row.trigger || { type: 'comment' },
    keywordRules: row.keyword_rules || [],
    exclusions: row.settings?.exclusions || [],
    publicReplies: row.public_replies || [],
    flowId: row.flow_id,
    settings: {
      exclusions: row.settings?.exclusions || [],
      dailyCap: row.settings?.dailyCap ?? null,
      schedule: row.settings?.schedule || {
        timezone: 'UTC',
        startHour: 0,
        endHour: 24,
      },
    },
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Generic API requester
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw (body || { code: 'INTERNAL_ERROR', message: `Request failed with status ${response.status}` }) as ApiError;
  }
  return body as T;
}

// Seeded baseline for preview / offline demo
export const SEEDED_USER: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'developer@example.local',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  role: 'owner',
};

export const SEEDED_IG_ACCOUNT: InstagramAccount = {
  id: '33333333-3333-4333-8333-333333333333',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  igUserId: 'local-ig-account',
  username: 'local_account',
  accountType: 'BUSINESS',
  profilePictureUrl: '/src/assets/images/creator_avatar_1792499576904.jpg',
  permissions: ['instagram_business_basic', 'instagram_business_manage_comments', 'instagram_business_manage_messages'],
  status: 'active',
  tokenExpiresAt: null,
};

export const SEEDED_AUTOMATION: RawAutomationRow = {
  id: '44444444-4444-4444-8444-444444444444',
  ig_account_id: '33333333-3333-4333-8333-333333333333',
  name: 'Local guide automation',
  status: 'live',
  trigger: { type: 'comment' },
  keyword_rules: [
    {
      value: 'guide',
      mode: 'contains',
      caseSensitive: false,
    },
  ],
  public_replies: ['Thanks! Check your DMs for the free guide.'],
  flow_id: null,
  settings: {
    exclusions: [],
    dailyCap: null,
    schedule: {
      timezone: 'UTC',
      startHour: 0,
      endHour: 24,
    },
  },
  created_by: '22222222-2222-4222-8222-222222222222',
  created_at: '2026-10-17T00:00:00.000Z',
  updated_at: '2026-10-17T00:00:00.000Z',
};

export const SEEDED_TRIGGER_EVENTS: TriggerEvent[] = [
  {
    id: 'evt-1001-4111-8111-222222222222',
    ig_account_id: '33333333-3333-4333-8333-333333333333',
    automation_id: '44444444-4444-4444-8444-444444444444',
    comment_id: 'ig_cmt_9482710384',
    comment_text: 'Can I get the guide? Need this for our launch!',
    matched_keyword: 'guide',
    outcome: 'queued',
    reason_code: null,
    attempts: 1,
    created_at: '2026-10-20T03:14:00.000Z',
    sent_at: null,
  },
  {
    id: 'evt-1002-4111-8111-222222222222',
    ig_account_id: '33333333-3333-4333-8333-333333333333',
    automation_id: '44444444-4444-4444-8444-444444444444',
    comment_id: 'ig_cmt_9482710399',
    comment_text: 'Replying to @alex: Check out this guide',
    matched_keyword: null,
    outcome: 'skipped',
    reason_code: 'NOT_TOP_LEVEL',
    attempts: 0,
    created_at: '2026-10-20T04:22:00.000Z',
    sent_at: null,
  },
  {
    id: 'evt-1003-4111-8111-222222222222',
    ig_account_id: '33333333-3333-4333-8333-333333333333',
    automation_id: '44444444-4444-4444-8444-444444444444',
    comment_id: 'ig_cmt_9482710412',
    comment_text: 'guide please! excited to read',
    matched_keyword: 'guide',
    outcome: 'queued',
    reason_code: null,
    attempts: 1,
    created_at: '2026-10-20T05:10:00.000Z',
    sent_at: null,
  },
];
