'use client';

import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import {
  Send,
  Sparkles,
  TrendingUp,
  Instagram,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Zap,
  ChevronDown,
  User,
  ExternalLink,
} from 'lucide-react';
import { AVATAR_URL, MOCK_IG_POSTS, INITIAL_CAMPAIGNS } from '@/src/data/mockData';

export interface DashboardAccountHubProps {
  onNavigateToBuilder?: () => void;
  onAddAccountOAuth?: () => void;
}

export default function DashboardAccountHub({
  onNavigateToBuilder,
  onAddAccountOAuth,
}: DashboardAccountHubProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('acc-1');
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d'>('7d');

  // Multi-account workspace list
  const connectedAccounts = [
    {
      id: 'acc-1',
      username: 'elena.creates',
      displayName: 'Elena Rostova',
      followers: 84200,
      avatarUrl: AVATAR_URL,
      status: 'ACTIVE' as const,
      automationsCount: 4,
      dmsSent: 4892,
    },
    {
      id: 'acc-2',
      username: 'elenadesign.studio',
      displayName: 'Elena Design Studio',
      followers: 24500,
      avatarUrl: AVATAR_URL,
      status: 'ACTIVE' as const,
      automationsCount: 2,
      dmsSent: 1240,
    },
    {
      id: 'acc-3',
      username: 'creator.academy_official',
      displayName: 'Creator Academy Hub',
      followers: 12100,
      avatarUrl: AVATAR_URL,
      status: 'NEEDS_REAUTH' as const,
      automationsCount: 1,
      dmsSent: 820,
    },
  ];

  const currentAccount = connectedAccounts.find((a) => a.id === selectedAccountId) || connectedAccounts[0];

  // Real-time activity feed table data
  const recentActivities = [
    {
      id: 'act-1',
      timestamp: '2 mins ago',
      postThumb: MOCK_IG_POSTS[0].thumbnailUrl,
      postCaption: 'How we generated $42K in digital product sales...',
      userHandle: 'sarah_marketing',
      matchedKeyword: 'guide',
      status: 'SUCCESS' as const,
    },
    {
      id: 'act-2',
      timestamp: '14 mins ago',
      postThumb: MOCK_IG_POSTS[1].thumbnailUrl,
      postCaption: 'Sunday styling: oversized tailoring meets calm...',
      userHandle: 'marcus_design',
      matchedKeyword: 'outfit',
      status: 'SUCCESS' as const,
    },
    {
      id: 'act-3',
      timestamp: '32 mins ago',
      postThumb: MOCK_IG_POSTS[2].thumbnailUrl,
      postCaption: 'New color profiles are live! Film simulation...',
      userHandle: 'chloe_photos',
      matchedKeyword: 'presets',
      status: 'SUCCESS' as const,
    },
    {
      id: 'act-4',
      timestamp: '1 hour ago',
      postThumb: MOCK_IG_POSTS[0].thumbnailUrl,
      postCaption: 'How we generated $42K in digital product sales...',
      userHandle: 'private_account_99',
      matchedKeyword: 'guide',
      status: 'FAILED' as const,
      reason: 'User has strict DM request filters enabled',
    },
  ];

  const handleCreateNew = () => {
    if (onNavigateToBuilder) {
      onNavigateToBuilder();
    } else {
      window.location.href = '/automations/new';
    }
  };

  const handleAddAccount = () => {
    if (onAddAccountOAuth) {
      onAddAccountOAuth();
    } else {
      window.location.assign('https://www.instagram.com/oauth/authorize?...');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. HEADER & WORKSPACE SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-100">
        <div>
          <div className="flex items-center gap-3">
            {/* Account Switcher Dropdown */}
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-sky-200/90 bg-white font-bold text-slate-900 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
              >
                {connectedAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username} ({acc.followers.toLocaleString()} followers)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1">
            Managing automated comment keywords & direct messages for <strong>@{currentAccount.username}</strong>
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAccount}
            className="gap-2"
          >
            <Instagram className="w-4 h-4 text-sky-600" />
            <span>Connect Another Account</span>
          </Button>

          <Button
            variant="brand"
            size="sm"
            onClick={handleCreateNew}
            className="gap-2 shadow-sm shadow-sky-500/20"
          >
            <Plus className="w-4 h-4 text-cyan-200" />
            <span>Create New Automation</span>
          </Button>
        </div>
      </div>

      {/* 2. ANALYTICS QUICK SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Total DMs Sent */}
        <Card className="hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total DMs Dispatched
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {currentAccount.dmsSent.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-sky-700 font-semibold inline-flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> +24.8%
              </span>
              <span>·</span>
              <span>Last 30 days</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Comment Conversion Rate */}
        <Card className="hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Comment-to-DM Conversion
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              88.4%
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-cyan-700 font-semibold inline-flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> +5.2%
              </span>
              <span>·</span>
              <span>industry benchmark 64%</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Active Automations Count */}
        <Card className="hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Automations
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {currentAccount.automationsCount} Live
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-teal-700 font-semibold inline-flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Uptime
              </span>
              <span>·</span>
              <span>listening on Webhook</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. CONNECTED ACCOUNTS PANEL (Multi-account manager) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Connected Instagram Business Accounts
            </h2>
            <p className="text-xs text-slate-500">
              Manage multi-account permissions and Meta Graph API credentials
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddAccount} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {connectedAccounts.map((acc) => {
            const isSelected = selectedAccountId === acc.id;
            return (
              <Card
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-2 border-sky-500 ring-4 ring-sky-400/15 bg-white shadow-md'
                    : 'hover:border-sky-300 bg-white/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full ring-2 ring-sky-200 overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={acc.avatarUrl}
                        alt={acc.username}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        @{acc.username}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {acc.displayName}
                      </p>
                      <p className="text-[10px] font-mono text-sky-700 mt-0.5">
                        {acc.followers.toLocaleString()} followers
                      </p>
                    </div>
                  </div>

                  <div>
                    {acc.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                        Re-auth
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 4. RECENT ACTIVITY FEED (Real-Time Table) */}
      <Card className="p-0 overflow-hidden border border-sky-100">
        <div className="p-5 border-b border-sky-100/80 bg-sky-50/40 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Real-Time Activity Feed
            </h2>
            <p className="text-xs text-slate-500">
              Live comment keyword matches and automated DM dispatch results
            </p>
          </div>
          <span className="text-[11px] font-mono text-sky-700 bg-white px-2.5 py-1 rounded-md border border-sky-200/80 shadow-2xs font-semibold">
            Auto-refreshing (5s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50/60 border-b border-sky-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Timestamp</th>
                <th className="py-3.5 px-4">Post / Reel</th>
                <th className="py-3.5 px-4">User Handle</th>
                <th className="py-3.5 px-4">Trigger Keyword</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Dispatch Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70">
              {recentActivities.map((act) => (
                <tr key={act.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6 text-xs font-mono text-slate-500 whitespace-nowrap">
                    {act.timestamp}
                  </td>

                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg border border-sky-200 overflow-hidden shrink-0 bg-slate-100">
                        <img
                          src={act.postThumb}
                          alt="Post thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-slate-800 line-clamp-1 truncate font-medium">
                        {act.postCaption}
                      </p>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-xs font-medium text-slate-900">
                    @{act.userHandle}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-sky-800 bg-sky-100/70 px-2 py-0.5 rounded border border-sky-200/60">
                      #{act.matchedKeyword}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 sm:px-6 text-right">
                    {act.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>DM Delivered</span>
                      </span>
                    ) : (
                      <span
                        title={act.reason}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200/60"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delivery Failed</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
