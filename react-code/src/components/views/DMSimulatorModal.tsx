import React, { useState } from 'react';
import { DMAutomationCampaign, BioProfile, IGPost } from '../../types';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Send,
  Sparkles,
  CheckCircle2,
  Instagram,
  ArrowRight,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

export interface DMSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: DMAutomationCampaign[];
  profile: BioProfile;
  posts: IGPost[];
  onTriggerDM: (campaignId: string) => void;
}

export const DMSimulatorModal: React.FC<DMSimulatorModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  profile,
  posts,
  onTriggerDM,
}) => {
  const [commentText, setCommentText] = useState('Hey Elena, could you send me the guide?');
  const [activeTab, setActiveTab] = useState<'comment' | 'dm'>('comment');
  const [dispatchedMessage, setDispatchedMessage] = useState<{
    campaign: DMAutomationCampaign;
    body: string;
    timestamp: string;
  } | null>(null);

  const [matchError, setMatchError] = useState<string | null>(null);

  const handleTestComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    // Detect matched campaign by keyword
    const lowerComment = commentText.toLowerCase();
    const matched = campaigns.find(
      (c) => c.isActive && lowerComment.includes(c.triggerKeyword.toLowerCase())
    );

    if (matched) {
      setMatchError(null);
      // Format message body
      const body = matched.dmMessage
        .replace('{link}', matched.actionUrl)
        .replace('{name}', 'Alex');

      setDispatchedMessage({
        campaign: matched,
        body,
        timestamp: 'Just now',
      });
      onTriggerDM(matched.id);
      setActiveTab('dm');
    } else {
      const activeKw = campaigns.filter(c => c.isActive).map(c => `"${c.triggerKeyword}"`).join(', ') || 'none';
      setMatchError(`No active campaign matched. Available keywords: ${activeKw}`);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Live Instagram Automation Simulator"
      description="Simulate a real follower commenting on your post to test instant DM dispatching."
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Step Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('comment')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'comment'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>1. Follower Commenting</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dm')}
            disabled={!dispatchedMessage}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'dm'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>2. Direct Message Inbox</span>
          </button>
        </div>

        {/* VIEW A: Comment Simulation */}
        {activeTab === 'comment' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Instagram className="w-4 h-4 text-pink-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Select a Keyword to Test:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {campaigns
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setCommentText(`I'd love to get the ${c.triggerKeyword} please!`)
                      }
                      className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:border-indigo-400 text-xs font-mono text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      "{c.triggerKeyword}"
                    </button>
                  ))}
              </div>
            </div>

            <form onSubmit={handleTestComment} className="space-y-3">
              {matchError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  {matchError}
                </div>
              )}

              <label className="block text-xs font-medium text-slate-700">
                Simulated Comment from Follower (@alex_creative):
              </label>
              <div className="relative">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type a comment with your keyword..."
                  className="pr-10"
                />
              </div>

              <Button type="submit" variant="brand" className="w-full">
                <Send className="w-4 h-4 mr-2" />
                <span>Simulate Post Comment & Dispatch DM</span>
              </Button>
            </form>
          </div>
        )}

        {/* VIEW B: Instagram DM Chat Screen Simulation */}
        {activeTab === 'dm' && dispatchedMessage && (
          <div className="space-y-4">
            {/* Instagram DM Phone Container Mockup */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden max-w-sm mx-auto">
              {/* IG DM Top bar */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full ring-1 ring-slate-300 overflow-hidden bg-slate-200 shrink-0">
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-900">
                        {profile.username}
                      </span>
                      <CheckCircle2 className="w-3 h-3 text-blue-500 fill-blue-500 text-white" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Active now</span>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-semibold">
                  Auto DM
                </span>
              </div>

              {/* IG Chat Body */}
              <div className="p-4 space-y-3 bg-gradient-to-b from-slate-50/50 to-white min-h-[220px] flex flex-col justify-end">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {dispatchedMessage.timestamp}
                  </span>
                </div>

                {/* Received Bubble */}
                <div className="flex flex-col items-start space-y-1.5 max-w-[85%]">
                  <div className="p-3.5 rounded-2xl rounded-tl-xs bg-slate-100 text-slate-900 text-xs leading-relaxed whitespace-pre-wrap shadow-xs">
                    {dispatchedMessage.body}
                  </div>

                  {/* Link Preview Card */}
                  <a
                    href={dispatchedMessage.campaign.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-indigo-400 transition-colors flex items-center justify-between gap-2 w-full cursor-pointer"
                  >
                    <div className="truncate">
                      <p className="text-[11px] font-semibold text-slate-800 truncate">
                        {dispatchedMessage.campaign.name}
                      </p>
                      <p className="text-[10px] text-indigo-600 font-mono truncate">
                        {dispatchedMessage.campaign.actionUrl}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                </div>
              </div>

              {/* IG Fake Input footer */}
              <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
                <span>Message...</span>
                <Send className="w-4 h-4 text-slate-300" />
              </div>
            </div>

            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('comment')}
              >
                Test Another Comment
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
