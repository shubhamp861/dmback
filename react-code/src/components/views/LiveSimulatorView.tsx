import React, { useState } from 'react';
import { DMAutomationCampaign, IGPost } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Send,
  Sparkles,
  CheckCircle2,
  Instagram,
  ExternalLink,
  MessageCircle,
  Clock,
  Zap,
  ShieldCheck,
  Check,
} from 'lucide-react';

export interface LiveSimulatorViewProps {
  campaigns: DMAutomationCampaign[];
  posts: IGPost[];
  onTriggerDM: (campaignId: string) => void;
  onOpenCreateCampaign: () => void;
}

export const LiveSimulatorView: React.FC<LiveSimulatorViewProps> = ({
  campaigns,
  posts,
  onTriggerDM,
  onOpenCreateCampaign,
}) => {
  const [selectedPostId, setSelectedPostId] = useState<string>(posts[0]?.id || '');
  const [commentText, setCommentText] = useState('Hey! Can you send me the guide?');
  const [dispatchedMessage, setDispatchedMessage] = useState<{
    campaign: DMAutomationCampaign;
    body: string;
    timestamp: string;
  } | null>({
    campaign: campaigns[0],
    body: campaigns[0].dmMessage
      .replace('{link}', campaigns[0].actionUrl)
      .replace('{name}', 'Alex'),
    timestamp: 'Just now',
  });
  const [matchedNotification, setMatchedNotification] = useState<string | null>(null);

  const selectedPost = posts.find((p) => p.id === selectedPostId) || posts[0];
  const activeCampaigns = campaigns.filter((c) => c.isActive);

  const handleTestComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const lowerComment = commentText.toLowerCase();

    // Match rule: either campaign is for ALL_POSTS or attached to this post, and matches triggerKeyword
    const matched = campaigns.find(
      (c) =>
        c.isActive &&
        (c.postId === 'ALL_POSTS' || c.postId === selectedPostId) &&
        lowerComment.includes(c.triggerKeyword.toLowerCase())
    );

    if (matched) {
      const body = matched.dmMessage
        .replace('{link}', matched.actionUrl)
        .replace('{name}', 'Alex');

      setDispatchedMessage({
        campaign: matched,
        body,
        timestamp: 'Just now',
      });
      onTriggerDM(matched.id);
      setMatchedNotification(`Keyword matched: #${matched.triggerKeyword} → Dispatched automated DM`);
      setTimeout(() => setMatchedNotification(null), 3500);
    } else {
      const activeKw = activeCampaigns.map((c) => `#${c.triggerKeyword}`).join(', ') || 'none';
      setMatchedNotification(`No rule matched "${commentText}". Try keywords: ${activeKw}`);
      setTimeout(() => setMatchedNotification(null), 4000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-sky-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Live Comment & DM Simulator
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
              Real-time Sandbox
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Test how followers experience automated DMs by commenting on your Instagram feed posts.
          </p>
        </div>

        <Button variant="brand" size="sm" onClick={onOpenCreateCampaign} className="gap-2">
          <Zap className="w-4 h-4 text-cyan-200" />
          <span>New Keyword Rule</span>
        </Button>
      </div>

      {matchedNotification && (
        <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-xs font-semibold text-cyan-900 flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
          <span>{matchedNotification}</span>
        </div>
      )}

      {/* Two-Column Simulation: Left is Instagram Post & Commenter, Right is Instagram Direct Message screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Instagram Post Comment Stream (Follower perspective) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Post Selector */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Feed Post to Comment On
              </label>
              <span className="text-[11px] text-slate-400">
                {posts.length} connected posts
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {posts.map((post) => {
                const isSelected = selectedPostId === post.id;
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-square bg-slate-100 ${
                      isSelected
                        ? 'border-sky-500 ring-4 ring-sky-400/20 shadow-md'
                        : 'border-sky-100 hover:border-sky-300'
                    }`}
                  >
                    <img
                      src={post.thumbnailUrl}
                      alt="Post"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Simulated Instagram Post Mockup */}
          <div className="rounded-2xl border border-sky-100 bg-white/95 backdrop-blur-xs shadow-md overflow-hidden">
            <div className="p-4 border-b border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-cyan-500 p-0.5">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-[11px] text-sky-800">
                    ER
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">elena.creates</span>
                  <span className="block text-[10px] text-slate-400">Original Post</span>
                </div>
              </div>
              <Instagram className="w-4 h-4 text-sky-500" />
            </div>

            <div className="p-4 bg-slate-50/50">
              <p className="text-xs text-slate-700 leading-relaxed font-normal">
                {selectedPost.caption}
              </p>
            </div>

            {/* Quick Keyword Tap Chips */}
            <div className="p-4 border-t border-sky-100/80 bg-sky-50/30">
              <span className="text-[11px] font-semibold text-slate-600 block mb-2">
                Click a keyword rule to test:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeCampaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCommentText(`Hey! Can you send me the ${c.triggerKeyword} please?`)
                    }
                    className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 hover:border-sky-400 text-xs font-mono text-sky-800 hover:text-sky-900 transition-all cursor-pointer shadow-2xs font-semibold"
                  >
                    #{c.triggerKeyword}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleTestComment} className="p-4 border-t border-sky-100 flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment with a keyword..."
                className="flex-1 text-xs"
              />
              <Button type="submit" variant="brand" size="sm" className="gap-1.5 shrink-0">
                <Send className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </Button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Instagram Direct Message (Receiver's Inbox) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-[340px] mb-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Follower's DM Inbox</span>
            <span className="text-[11px] font-mono text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200/60">
              Instant Dispatch
            </span>
          </div>

          {/* Smartphone Mockup */}
          <div className="relative w-full max-w-[340px] h-[600px] bg-slate-900 rounded-[44px] p-3 shadow-2xl ring-1 ring-sky-900/40 ring-offset-2 flex flex-col overflow-hidden">
            {/* Dynamic Island */}
            <div className="absolute top-4 inset-x-0 mx-auto w-24 h-5 bg-black rounded-full z-20 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800/80 mr-4" />
              <div className="w-2 h-2 rounded-full bg-sky-950" />
            </div>

            {/* Screen Bezel Inside */}
            <div className="relative w-full h-full rounded-[34px] overflow-hidden bg-white flex flex-col">
              {/* Status Bar */}
              <div className="h-9 w-full flex items-center justify-between px-6 pt-1 text-[10px] font-semibold text-slate-900 z-10 shrink-0 select-none opacity-80">
                <span>9:41</span>
                <span className="text-[9px]">5G</span>
              </div>

              {/* IG DM Top bar */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full ring-1 ring-sky-300 overflow-hidden bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-800">
                    ER
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-900">elena.creates</span>
                      <CheckCircle2 className="w-3 h-3 text-sky-500 fill-sky-500 text-white" />
                    </div>
                    <span className="text-[9px] text-slate-400">Active now</span>
                  </div>
                </div>

                <span className="text-[9px] font-mono text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded font-semibold border border-cyan-200/60">
                  Automated
                </span>
              </div>

              {/* DM Chat Feed */}
              <div className="p-4 space-y-3 bg-gradient-to-b from-sky-50/20 via-white to-sky-50/30 flex-1 overflow-y-auto flex flex-col justify-end">
                {dispatchedMessage ? (
                  <>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400">
                        {dispatchedMessage.timestamp}
                      </span>
                    </div>

                    <div className="flex flex-col items-start space-y-2 max-w-[90%]">
                      {/* Message Bubble */}
                      <div className="p-3.5 rounded-2xl rounded-tl-xs bg-slate-100 text-slate-900 text-xs leading-relaxed whitespace-pre-wrap shadow-2xs">
                        {dispatchedMessage.body}
                      </div>

                      {/* Action URL Card */}
                      <a
                        href={dispatchedMessage.campaign.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-white border border-sky-200 hover:border-sky-400 shadow-xs transition-colors flex items-center justify-between gap-2 w-full cursor-pointer"
                      >
                        <div className="truncate">
                          <p className="text-[11px] font-bold text-slate-800 truncate">
                            {dispatchedMessage.campaign.name}
                          </p>
                          <p className="text-[10px] text-sky-600 font-mono truncate">
                            {dispatchedMessage.campaign.actionUrl}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center text-slate-400 text-xs">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-sky-400" />
                    <p>Post a comment with an active keyword to trigger a direct message.</p>
                  </div>
                )}
              </div>

              {/* DM Input bar */}
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between shrink-0">
                <span>Message elena.creates...</span>
                <Send className="w-3.5 h-3.5 text-slate-300" />
              </div>

              {/* Mobile Home indicator */}
              <div className="h-3 w-full flex items-center justify-center shrink-0">
                <div className="w-24 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
