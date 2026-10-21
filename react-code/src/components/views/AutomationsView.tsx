import React, { useState } from 'react';
import { DMAutomationCampaign, IGPost, BioProfile } from '../../types';
import { Card, StatusBadge } from '../ui/Card';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { CreateCampaignSheet } from './CreateCampaignSheet';
import { DMSimulatorModal } from './DMSimulatorModal';
import { TriggerEventsModal } from './TriggerEventsModal';
import VisualFlowBuilderPage from '../../app/automations/new/page';
import { SEEDED_TRIGGER_EVENTS, TriggerEvent, ReplayResponse } from '../../lib/api';
import {
  Plus,
  Play,
  Zap,
  Trash2,
  ExternalLink,
  MessageCircle,
  Search,
  Globe,
  Instagram,
  Filter,
  Activity,
  RotateCcw,
  Layers,
  ArrowLeft,
} from 'lucide-react';

export interface AutomationsViewProps {
  campaigns: DMAutomationCampaign[];
  posts: IGPost[];
  profile: BioProfile;
  userRole?: string;
  onAddCampaign: (campaign: Omit<DMAutomationCampaign, 'id' | 'dmSentCount' | 'createdAt'>) => void;
  onToggleCampaign: (id: string, active: boolean) => void;
  onDeleteCampaign: (id: string) => void;
  onTriggerDM: (campaignId: string) => void;
  onReplayWebhook?: (eventId: string) => Promise<ReplayResponse>;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  campaigns,
  posts,
  profile,
  userRole = 'owner',
  onAddCampaign,
  onToggleCampaign,
  onDeleteCampaign,
  onTriggerDM,
  onReplayWebhook,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [selectedEventsCamp, setSelectedEventsCamp] = useState<DMAutomationCampaign | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter((camp) => {
    const matchesSearch =
      camp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camp.triggerKeyword.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? camp.isActive
        : !camp.isActive;
    return matchesSearch && matchesStatus;
  });

  if (showFlowBuilder) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-sky-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFlowBuilder(false)}
            className="gap-2 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>&larr; Back to Automations Table</span>
          </Button>
          <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-3 py-1 rounded-md border border-sky-200">
            Node-Based Instagram Flow Canvas
          </span>
        </div>
        <VisualFlowBuilderPage
          onBack={() => setShowFlowBuilder(false)}
          onSave={(flowData: any) => {
            const primaryKw = Array.isArray(flowData?.keywordsList) && flowData.keywordsList.length > 0
              ? flowData.keywordsList[0]
              : 'guide';
            const firstDm = Array.isArray(flowData?.dmVariations) && flowData.dmVariations.length > 0
              ? flowData.dmVariations[0]
              : { bodyText: 'Hey there! {link}', redirectUrl: 'https://masterclass.elenarostova.com' };
            const selectedPost = posts.find((p) => p.id === flowData?.selectedPostId);

            onAddCampaign({
              name: flowData?.title || 'New Automated Flow',
              triggerKeyword: primaryKw,
              actionUrl: firstDm.redirectUrl || 'https://masterclass.elenarostova.com',
              dmMessage: firstDm.bodyText || 'Hey! Check this out: {link}',
              postId: flowData?.targetPostMode === 'ALL_POSTS' ? 'ALL_POSTS' : (flowData?.selectedPostId || posts[0]?.id),
              postThumbnailUrl: flowData?.targetPostMode === 'ALL_POSTS' ? undefined : selectedPost?.thumbnailUrl,
              postCaption: flowData?.targetPostMode === 'ALL_POSTS' ? 'All Posts' : selectedPost?.caption,
              isActive: flowData?.isActive ?? true,
            });
            setShowFlowBuilder(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-sky-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Instagram DM Automations
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
              Active Rules
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Trigger automated Instagram Direct Messages whenever users leave specific keywords in your comments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFlowBuilder(true)}
            className="gap-2 text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100 text-xs"
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Visual Flow Builder</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSimulatorOpen(true)}
            className="gap-2 text-xs"
          >
            <Play className="w-3.5 h-3.5 text-sky-600 fill-sky-600" />
            <span>Test Simulator</span>
          </Button>

          <Button
            variant="brand"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 text-xs"
          >
            <Plus className="w-4 h-4 text-cyan-200" />
            <span>New DM Campaign</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search campaigns or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-sky-200/80 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-sky-50 rounded-lg text-xs font-medium border border-sky-100/80">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({campaigns.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({campaigns.filter((c) => c.isActive).length})
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterStatus === 'inactive'
                ? 'bg-white text-slate-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inactive ({campaigns.filter((c) => !c.isActive).length})
          </button>
        </div>
      </div>

      {/* ACTIVE CAMPAIGNS OVERVIEW TABLE */}
      <Card className="p-0 overflow-hidden border border-sky-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50/70 border-b border-sky-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Campaign & Attached Post</th>
                <th className="py-3.5 px-4">Trigger Keyword</th>
                <th className="py-3.5 px-4">Linked Action URL</th>
                <th className="py-3.5 px-4 text-right">DMs Sent</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70">
              {filteredCampaigns.map((camp) => (
                <tr
                  key={camp.id}
                  className="hover:bg-sky-50/40 transition-colors group"
                >
                  {/* Campaign Name & Post thumbnail */}
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      {camp.postId === 'ALL_POSTS' ? (
                        <div
                          title="Applies to all posts"
                          className="w-11 h-11 rounded-lg bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600 shrink-0"
                        >
                          <Globe className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg border border-sky-200/80 overflow-hidden shrink-0 bg-slate-100">
                          {camp.postThumbnailUrl ? (
                            <img
                              src={camp.postThumbnailUrl}
                              alt="Post"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Instagram className="w-5 h-5 text-sky-400 m-3" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {camp.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                          {camp.postId === 'ALL_POSTS'
                            ? 'Triggered across all Instagram feed posts'
                            : camp.postCaption || 'Specific post attachment'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Trigger Keyword */}
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-100/70 font-mono text-xs font-semibold text-sky-800 border border-sky-200/60">
                      <span>#</span>
                      <span>{camp.triggerKeyword}</span>
                    </span>
                  </td>

                  {/* Linked Action URL */}
                  <td className="py-4 px-4">
                    <a
                      href={camp.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 hover:text-sky-600 hover:underline max-w-[160px] truncate"
                    >
                      <span className="truncate">{camp.actionUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                    </a>
                  </td>

                  {/* DM Sent Count */}
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {camp.dmSentCount.toLocaleString()}
                    </span>
                    <span className="block text-[11px] text-slate-400">delivered</span>
                  </td>

                  {/* Status Switch */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <StatusBadge status={camp.isActive ? 'active' : 'inactive'} />
                      <Switch
                        checked={camp.isActive}
                        onCheckedChange={(checked) => onToggleCampaign(camp.id, checked)}
                        ariaLabel={`Toggle status for ${camp.name}`}
                      />
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEventsCamp(camp)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                        title="View Trigger Events & Outbox"
                        aria-label="View Trigger Events"
                      >
                        <Activity className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSimulatorOpen(true)}
                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                        title="Test automation with sample comment"
                        aria-label="Test automation"
                      >
                        <Play className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteCampaign(camp.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                        title="Delete campaign"
                        aria-label="Delete campaign"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCampaigns.length === 0 && (
            <div className="py-16 text-center">
              <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No campaigns found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery
                  ? 'Try a different search keyword.'
                  : 'Get started by creating your first Instagram automated DM rule.'}
              </p>
              {!searchQuery && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4"
                >
                  Create Campaign
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Sheets & Modals */}
      <CreateCampaignSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        posts={posts}
        onSaveCampaign={onAddCampaign}
      />

      <DMSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        campaigns={campaigns}
        profile={profile}
        posts={posts}
        onTriggerDM={onTriggerDM}
      />

      {selectedEventsCamp && (
        <TriggerEventsModal
          isOpen={!!selectedEventsCamp}
          onClose={() => setSelectedEventsCamp(null)}
          automationName={selectedEventsCamp.name}
          automationId={selectedEventsCamp.id}
          events={SEEDED_TRIGGER_EVENTS}
          userRole={userRole}
          onReplayWebhook={async (eventId) => {
            if (onReplayWebhook) {
              return await onReplayWebhook(eventId);
            }
            return {
              id: `replay-${Date.now()}`,
              webhookEventId: eventId,
              status: 'pending',
            };
          }}
        />
      )}
    </div>
  );
};
