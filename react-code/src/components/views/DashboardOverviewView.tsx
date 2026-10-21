import React, { useState } from 'react';
import { DMAutomationCampaign, IGPost, AnalyticsDay } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  MessageSquare,
  Send,
  Zap,
  TrendingUp,
  ArrowUpRight,
  Play,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Instagram,
  ShieldCheck,
  Plus,
  ChevronDown,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AVATAR_URL } from '../../data/mockData';

export interface DashboardOverviewViewProps {
  campaigns: DMAutomationCampaign[];
  posts: IGPost[];
  analyticsData: AnalyticsDay[];
  onNavigateTab: (tab: 'automations' | 'simulator' | 'events') => void;
  onOpenCreateCampaign: () => void;
  onAddAccountOAuth?: () => void;
}

export const DashboardOverviewView: React.FC<DashboardOverviewViewProps> = ({
  campaigns,
  posts,
  analyticsData,
  onNavigateTab,
  onOpenCreateCampaign,
  onAddAccountOAuth,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState('acc-1');
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d'>('7d');
  const [activeMetric, setActiveMetric] = useState<'all' | 'comments' | 'dms'>('all');
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

  // Multi-account workspace list
  const connectedAccounts = [
    {
      id: 'acc-1',
      username: 'elena.creates',
      displayName: 'Elena Rostova',
      followers: 84200,
      avatarUrl: AVATAR_URL,
      status: 'ACTIVE' as const,
      automationsCount: campaigns.length,
      dmsSent: campaigns.reduce((sum, c) => sum + c.dmSentCount, 4892),
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

  // Filter data based on time range
  const sliceCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 20;
  const chartData = analyticsData.slice(-sliceCount).map((d) => ({
    date: d.date,
    dayLabel: d.dayLabel,
    comments: Math.round(d.views * 0.8), // simulated comments checked
    dms: d.dms,
    rate: Math.min(100, Math.round((d.dms / Math.max(1, d.dms * 1.02)) * 100)),
  }));

  // Aggregate metrics
  const totalDMs = campaigns.reduce((sum, c) => sum + c.dmSentCount, 0);
  const activeRulesCount = campaigns.filter((c) => c.isActive).length;

  // Real-time activity feed table data
  const recentActivities = [
    {
      id: 'act-1',
      timestamp: 'Just now',
      postThumb: posts[0]?.thumbnailUrl,
      postCaption: posts[0]?.caption || 'Masterclass playbook launch...',
      userHandle: 'sarah_marketing',
      matchedKeyword: 'guide',
      status: 'SUCCESS' as const,
      dmCopy: 'Hey Sarah! ✨ Here is your free VIP Masterclass access link: https://masterclass.elenarostova.com',
    },
    {
      id: 'act-2',
      timestamp: '4 mins ago',
      postThumb: posts[1]?.thumbnailUrl,
      postCaption: posts[1]?.caption || 'Sunday streetwear style notes...',
      userHandle: 'marcus_design',
      matchedKeyword: 'outfit',
      status: 'SUCCESS' as const,
      dmCopy: 'Hey Marcus! Here are the styling credits and outfit shopping links 📩',
    },
    {
      id: 'act-3',
      timestamp: '18 mins ago',
      postThumb: posts[2]?.thumbnailUrl,
      postCaption: posts[2]?.caption || 'Film color profiles & Lightroom presets...',
      userHandle: 'chloe_photos',
      matchedKeyword: 'presets',
      status: 'SUCCESS' as const,
      dmCopy: 'Hey Chloe! Your 5 film simulation presets are ready for download!',
    },
    {
      id: 'act-4',
      timestamp: '45 mins ago',
      postThumb: posts[0]?.thumbnailUrl,
      postCaption: posts[0]?.caption || 'Masterclass playbook launch...',
      userHandle: 'private_user_44',
      matchedKeyword: 'guide',
      status: 'FAILED' as const,
      reason: 'Recipient message request privacy settings blocked automated delivery',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. HEADER & WORKSPACE SWITCHER + QUICK ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-100">
        <div>
          <div className="flex items-center gap-3">
            {/* Account Switcher Dropdown */}
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-sky-200/90 bg-white font-bold text-slate-900 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
              >
                {connectedAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username} ({acc.followers.toLocaleString()} followers)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
            onClick={() => onNavigateTab('simulator')}
            className="gap-2"
          >
            <Play className="w-3.5 h-3.5 text-sky-600 fill-sky-600" />
            <span>Comment Simulator</span>
          </Button>

          <Button
            variant="brand"
            size="sm"
            onClick={onOpenCreateCampaign}
            className="gap-2 shadow-sm shadow-sky-500/20"
          >
            <Zap className="w-4 h-4 text-cyan-200" />
            <span>Create New Automation</span>
          </Button>
        </div>
      </div>

      {/* 2. ANALYTICS QUICK SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total DMs Sent */}
        <Card className="hover:border-sky-300 transition-all p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total DMs Sent
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {(currentAccount.dmsSent + totalDMs).toLocaleString()}
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
        <Card className="hover:border-sky-300 transition-all p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Comment Conversion Rate
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
              <span>Industry avg 64%</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Active Automations Count */}
        <Card className="hover:border-sky-300 transition-all p-5">
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
              {activeRulesCount} Live
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-teal-700 font-semibold inline-flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Uptime
              </span>
              <span>·</span>
              <span>Listening on Webhook</span>
            </div>
          </div>
        </Card>

        {/* Card 4: Average Response Time */}
        <Card className="hover:border-sky-300 transition-all p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg Delivery Time
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              0.8s
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-indigo-700 font-medium inline-flex items-center">
                Real-time
              </span>
              <span>·</span>
              <span>Meta Graph Webhook</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. PERFORMANCE TREND CHART (Recharts - Ice Base Theme) */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-sky-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Comment Triggers vs. Automated DM Dispatches
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live comparison of incoming comments matching keywords and outbound direct messages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Metric Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-sky-50 rounded-lg text-xs font-medium border border-sky-100/80">
              <button
                onClick={() => setActiveMetric('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeMetric === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Metrics
              </button>
              <button
                onClick={() => setActiveMetric('comments')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeMetric === 'comments'
                    ? 'bg-white text-sky-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveMetric('dms')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeMetric === 'dms'
                    ? 'bg-white text-cyan-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                DMs Sent
              </button>
            </div>

            {/* Range Toggle */}
            <div className="flex items-center gap-1 p-1 bg-sky-50 rounded-lg text-xs font-medium border border-sky-100/80">
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === '7d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange('14d')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === '14d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                14 Days
              </button>
              <button
                onClick={() => setTimeRange('30d')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  timeRange === '30d'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="iceCommentsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="iceDmsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0f2fe" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#bae6fd' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0c4a6e',
                  borderRadius: '12px',
                  border: '1px solid #38bdf8',
                  color: '#fff',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.35)',
                }}
                labelStyle={{ fontWeight: 600, color: '#e0f2fe', marginBottom: '4px' }}
                itemStyle={{ padding: '2px 0' }}
              />

              {(activeMetric === 'all' || activeMetric === 'comments') && (
                <Area
                  type="monotone"
                  dataKey="comments"
                  name="Comments Monitored"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#iceCommentsGrad)"
                />
              )}
              {(activeMetric === 'all' || activeMetric === 'dms') && (
                <Area
                  type="monotone"
                  dataKey="dms"
                  name="Automated DMs Dispatched"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#iceDmsGrad)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-3 border-t border-sky-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-600 inline-block" />
            <span>Monitored Post Comments</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" />
            <span>Automated DMs Delivered</span>
          </div>
        </div>
      </Card>

      {/* 4. CONNECTED ACCOUNTS PANEL (Multi-Account Manager) */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={onAddAccountOAuth}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account via Meta</span>
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
                      <p className="text-[10px] font-mono text-sky-700 mt-0.5 font-semibold">
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

      {/* 5. RECENT ACTIVITY FEED (Real-Time Table) */}
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
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Post / Reel</th>
                <th className="py-3 px-4">User Handle</th>
                <th className="py-3 px-4">Trigger Keyword</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs text-slate-800">
              {recentActivities.map((act) => (
                <tr key={act.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {act.timestamp}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-sky-200">
                        <img
                          src={act.postThumb}
                          alt="post"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="truncate text-xs font-medium text-slate-700 max-w-[220px]">
                        {act.postCaption}
                      </p>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    @{act.userHandle}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-sky-100 text-sky-800">
                      #{act.matchedKeyword}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {act.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Dispatched
                      </span>
                    ) : (
                      <span
                        title={act.reason}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Filtered
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedActivity(act)}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      View DM &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Activity Details Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Dispatched Direct Message</h3>
              <button
                onClick={() => setSelectedActivity(null)}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Recipient:</span>{' '}
                <strong className="text-slate-900">@{selectedActivity.userHandle}</strong>
              </div>
              <div>
                <span className="text-slate-400">Trigger Keyword:</span>{' '}
                <span className="font-mono font-bold text-sky-700">#{selectedActivity.matchedKeyword}</span>
              </div>
              <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-100 text-slate-800 leading-relaxed">
                {selectedActivity.dmCopy || selectedActivity.reason}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedActivity(null)}
              className="w-full text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
