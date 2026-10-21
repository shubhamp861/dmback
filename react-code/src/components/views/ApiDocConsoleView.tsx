import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Code2,
  Lock,
  Shield,
  FileCode,
  Terminal,
  ExternalLink,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Layers,
  Send,
  Hash,
} from 'lucide-react';
import {
  SEEDED_USER,
  SEEDED_IG_ACCOUNT,
  SEEDED_AUTOMATION,
  SEEDED_TRIGGER_EVENTS,
} from '../../lib/api';

export const ApiDocConsoleView: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('automations_list');
  const [copied, setCopied] = useState(false);
  const [simulatedResponse, setSimulatedResponse] = useState<string | null>(null);

  const endpoints = [
    {
      id: 'auth_me',
      category: 'Auth',
      method: 'GET',
      path: '/v1/auth/me',
      title: 'Current Session Lookup',
      auth: 'Session Cookie (HttpOnly)',
      csrf: false,
      role: 'Any valid session',
      desc: 'Restores the current authenticated session. Returns 401 when unauthenticated.',
      sampleRequest: null,
      sampleResponse: {
        data: SEEDED_USER,
      },
    },
    {
      id: 'auth_login',
      category: 'Auth',
      method: 'POST',
      path: '/v1/auth/login',
      title: 'User Login',
      auth: 'None',
      csrf: false,
      role: 'Public',
      desc: 'Authenticates with email and password. Sets session (HttpOnly) and csrf_token cookies.',
      sampleRequest: {
        email: 'developer@example.local',
        password: 'local-development-password',
      },
      sampleResponse: {
        data: SEEDED_USER,
      },
    },
    {
      id: 'ig_accounts',
      category: 'Instagram',
      method: 'GET',
      path: '/v1/ig-accounts',
      title: 'Connected Accounts List',
      auth: 'Session Cookie',
      csrf: false,
      role: 'Owner / Admin / Editor / Viewer',
      desc: 'Lists workspace-scoped professional Instagram accounts without exposing access tokens.',
      sampleRequest: null,
      sampleResponse: {
        data: [SEEDED_IG_ACCOUNT],
      },
    },
    {
      id: 'automations_list',
      category: 'Automations',
      method: 'GET',
      path: '/v1/automations',
      title: 'List Workspace Automations',
      auth: 'Session Cookie',
      csrf: false,
      role: 'All roles',
      desc: 'Retrieves all automations. Note: responses return raw database snake_case rows.',
      sampleRequest: null,
      sampleResponse: {
        data: [SEEDED_AUTOMATION],
      },
    },
    {
      id: 'automations_create',
      category: 'Automations',
      method: 'POST',
      path: '/v1/automations',
      title: 'Create Automation',
      auth: 'Session Cookie',
      csrf: true,
      role: 'Owner / Admin / Editor',
      desc: 'Creates a new keyword automation. Request uses camelCase; response returns snake_case.',
      sampleRequest: {
        name: 'The 2026 Masterclass Guide',
        igAccountId: '33333333-3333-4333-8333-333333333333',
        trigger: { type: 'comment' },
        keywordRules: [
          { value: 'guide', mode: 'contains', caseSensitive: false },
        ],
        exclusions: [],
        publicReplies: ['Check your DMs! Link sent ✨'],
        flowId: null,
        settings: {
          dailyCap: 500,
          schedule: { timezone: 'UTC', startHour: 0, endHour: 24 },
        },
      },
      sampleResponse: {
        data: SEEDED_AUTOMATION,
      },
    },
    {
      id: 'automations_status',
      category: 'Automations',
      method: 'POST',
      path: '/v1/automations/:id/publish',
      title: 'Publish / Pause / Resume Status',
      auth: 'Session Cookie',
      csrf: true,
      role: 'Owner / Admin / Editor',
      desc: 'State mutation routes require x-csrf-token header matching csrf_token cookie. Returns HTTP 200.',
      sampleRequest: null,
      sampleResponse: {
        data: {
          ...SEEDED_AUTOMATION,
          status: 'live',
        },
      },
    },
    {
      id: 'automations_events',
      category: 'Automations',
      method: 'GET',
      path: '/v1/automations/:id/events',
      title: 'Trigger Events & Outbox Log',
      auth: 'Session Cookie',
      csrf: false,
      role: 'All roles',
      desc: 'Lists trigger events. Outcome "queued" confirms keyword matching succeeded into the idempotent outbox.',
      sampleRequest: null,
      sampleResponse: {
        data: SEEDED_TRIGGER_EVENTS,
      },
    },
    {
      id: 'webhook_replay',
      category: 'Webhooks',
      method: 'POST',
      path: '/v1/webhook-events/:id/replay',
      title: 'Audited Webhook Replay',
      auth: 'Session Cookie',
      csrf: true,
      role: 'Owner / Admin',
      desc: 'Creates an immutable webhook.replay.requested audit record and polls outbox. Returns HTTP 202 Accepted.',
      sampleRequest: null,
      sampleResponse: {
        data: {
          id: '55555555-5555-4555-8555-555555555555',
          webhookEventId: 'evt-1001-4111-8111-222222222222',
          status: 'pending',
        },
      },
    },
    {
      id: 'webhook_meta',
      category: 'Webhooks',
      method: 'POST',
      path: '/v1/webhooks/instagram',
      title: 'Meta Webhook Receiver',
      auth: 'x-hub-signature-256 (HMAC-SHA256)',
      csrf: false,
      role: 'Meta Webhook Engine',
      desc: 'Verified using Meta App Secret HMAC. Duplicate payloads protected by payload hash & trigger idempotency.',
      sampleRequest: {
        object: 'instagram',
        entry: [
          {
            id: 'local-ig-account',
            time: 1700000000,
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment-id-948',
                  text: 'guide please',
                  from: { id: 'commenter-user-id', username: 'follower_alex' },
                  media: { id: 'media-post-id' },
                },
              },
            ],
          },
        ],
      },
      sampleResponse: {
        received: true,
      },
    },
  ];

  const current = endpoints.find((e) => e.id === selectedEndpoint) || endpoints[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateRequest = () => {
    setSimulatedResponse(JSON.stringify(current.sampleResponse, null, 2));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              LinktoDM API & Authentication Mapping
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              v1 Specification
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Grounded directly in <code>/public/assets/aistudio/API-AUTH-MAPPING_e830a4dd.md</code>.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <span>Backend:</span>
          <span className="font-semibold text-slate-900">http://127.0.0.1:3000</span>
        </div>
      </div>

      {/* Architecture Highlights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Session Model</span>
          </div>
          <p className="text-xs text-slate-700">
            HttpOnly <code>session</code> cookie + non-HttpOnly <code>csrf_token</code> cookie. No Bearer tokens in localStorage.
          </p>
        </Card>

        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">CSRF Agreement</span>
          </div>
          <p className="text-xs text-slate-700">
            Mutations require <code>x-csrf-token</code> header matching the cookie. Missing token returns <code>403 CSRF_INVALID</code>.
          </p>
        </Card>

        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Terminal className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Naming Adapter</span>
          </div>
          <p className="text-xs text-slate-700">
            Requests use <strong>camelCase</strong>; database responses return <strong>snake_case</strong>. Normalizer adapter active.
          </p>
        </Card>

        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Matching Status</span>
          </div>
          <p className="text-xs text-slate-700">
            Outcome <code>queued</code> signifies successful rule matching recorded in the dispatch queue (not an actual DM sent).
          </p>
        </Card>
      </div>

      {/* Two-Column Explorer: Endpoint Selector on Left, Details/Tester on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Navigation */}
        <div className="lg:col-span-4 space-y-2">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Documented Endpoints ({endpoints.length})
          </label>
          <div className="space-y-1.5">
            {endpoints.map((ep) => {
              const isSelected = selectedEndpoint === ep.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEndpoint(ep.id);
                    setSimulatedResponse(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          ep.method === 'GET'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {ep.title}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-1">
                      {ep.path}
                    </p>
                  </div>

                  {ep.csrf && (
                    <span
                      title="CSRF Token Required"
                      className="text-[9px] font-mono font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded shrink-0"
                    >
                      CSRF
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Details & Interactive Tester */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-6 space-y-5">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      current.method === 'GET'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {current.method}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 font-mono">
                    {current.path}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">{current.desc}</p>
              </div>

              <Button
                variant="brand"
                size="sm"
                onClick={handleSimulateRequest}
                className="gap-2 shrink-0"
              >
                <Terminal className="w-4 h-4" />
                <span>Simulate Call</span>
              </Button>
            </div>

            {/* Contract Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Authentication
                </span>
                <span className="font-medium text-slate-800 mt-0.5 block">
                  {current.auth}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  CSRF Header Agreement
                </span>
                <span className="font-medium text-slate-800 mt-0.5 block">
                  {current.csrf ? 'Required (x-csrf-token)' : 'Not required'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Role Authorization
                </span>
                <span className="font-medium text-slate-800 mt-0.5 block">
                  {current.role}
                </span>
              </div>
            </div>

            {/* Request Schema (if applicable) */}
            {current.sampleRequest && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Request Payload (JSON Body)
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(current.sampleRequest, null, 2))}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(current.sampleRequest, null, 2)}
                </pre>
              </div>
            )}

            {/* Response Specification */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Response Envelope (JSON)
                </span>
                <span className="text-[11px] font-mono text-emerald-600 font-medium">
                  HTTP 200 / 201 / 202
                </span>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto">
                {simulatedResponse || JSON.stringify(current.sampleResponse, null, 2)}
              </pre>
            </div>
          </Card>

          {/* Seeded Development Credentials Helper */}
          <Card className="p-4 bg-slate-50 border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Seeded Development Credentials (Section 9)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <span className="text-slate-400">User: </span>
                developer@example.local
              </div>
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <span className="text-slate-400">Password: </span>
                local-development-password
              </div>
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <span className="text-slate-400">Workspace: </span>
                11111111-1111-4111-8111-111111111111
              </div>
              <div className="p-2 rounded bg-white border border-slate-200 text-slate-700">
                <span className="text-slate-400">Account: </span>
                local_account (local-ig-account)
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
