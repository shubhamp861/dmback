'use client';

import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input, Textarea } from '@/src/components/ui/Input';
import { Switch } from '@/src/components/ui/Switch';
import {
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Instagram,
  UserCheck,
  MessageSquare,
  Send,
  HelpCircle,
  Globe,
  Sliders,
} from 'lucide-react';
import { MOCK_IG_POSTS } from '@/src/data/mockData';

export interface VisualFlowBuilderProps {
  onSave?: (automationData: unknown) => void;
  onBack?: () => void;
}

export default function VisualFlowBuilderPage({ onSave, onBack }: VisualFlowBuilderProps) {
  // Canvas Header State
  const [title, setTitle] = useState('New Masterclass Comment Automation');
  const [isActive, setIsActive] = useState(true);

  // Step 1: Trigger Node
  const [triggerType, setTriggerType] = useState<'comment' | 'story_reply' | 'mention'>('comment');
  const [targetPostMode, setTargetPostMode] = useState<'ALL_POSTS' | 'SPECIFIC'>('SPECIFIC');
  const [selectedPostId, setSelectedPostId] = useState<string>(MOCK_IG_POSTS[0].id);
  const [keywordMatchMode, setKeywordMatchMode] = useState<'contains' | 'exact' | 'any'>('contains');
  const [keywordInput, setKeywordInput] = useState('guide');
  const [keywordsList, setKeywordsList] = useState<string[]>(['guide', 'free', 'pdf']);

  // Step 2: Condition Node (Follower Check)
  const [checkFollower, setCheckFollower] = useState(false);
  const [followerPromptMsg, setFollowerPromptMsg] = useState(
    'Hey {{first_name}}! Please hit "Follow" on @elena.creates first so I can send over the link! 🚀'
  );

  // Step 3: Action Node (Public Reply & DM Sequence with Rotation)
  const [publicReplies, setPublicReplies] = useState<string[]>([
    'Sent you a DM with the link! 🚀 Check your inbox.',
    'Just sent to your DMs! ✨ Let me know if you get it.',
  ]);
  const [newPublicReply, setNewPublicReply] = useState('');

  // Smart DM Rotation Tabs (up to 10 variations)
  const [activeDmVersion, setActiveDmVersion] = useState<number>(0);
  const [dmVariations, setDmVariations] = useState([
    {
      bodyText: 'Hey {{first_name}}! ✨ Thanks for leaving a comment on my post! Here is your exclusive VIP access link: {{link}}\n\nLet me know once you finish module 1!',
      buttonLabel: 'Watch Masterclass Free',
      redirectUrl: 'https://masterclass.elenarostova.com',
    },
    {
      bodyText: 'So excited to share this with you! Here is the direct link to download the 2026 playbook: {{link}}\n\nEnjoy learning!',
      buttonLabel: 'Download Free PDF',
      redirectUrl: 'https://masterclass.elenarostova.com/playbook',
    },
    {
      bodyText: 'Hey there! Your requested blueprint is ready. Tap below to claim your spot:',
      buttonLabel: 'Claim Access Now',
      redirectUrl: 'https://masterclass.elenarostova.com/access',
    },
  ]);

  // Step 4: Lead Capture Node
  const [captureLead, setCaptureLead] = useState(false);
  const [leadFieldType, setLeadFieldType] = useState<'email' | 'phone' | 'both'>('email');
  const [leadPromptText, setLeadPromptText] = useState(
    'What email address should I send your confirmation receipt to?'
  );

  const handleAddKeyword = () => {
    const cleaned = keywordInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleaned && !keywordsList.includes(cleaned)) {
      setKeywordsList([...keywordsList, cleaned]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywordsList(keywordsList.filter((k) => k !== kw));
  };

  const handleAddPublicReply = () => {
    if (newPublicReply.trim()) {
      setPublicReplies([...publicReplies, newPublicReply.trim()]);
      setNewPublicReply('');
    }
  };

  const handleRemovePublicReply = (index: number) => {
    setPublicReplies(publicReplies.filter((_, i) => i !== index));
  };

  const handleAddDmVariation = () => {
    if (dmVariations.length < 10) {
      const nextIndex = dmVariations.length + 1;
      setDmVariations([
        ...dmVariations,
        {
          bodyText: `Version ${nextIndex}: Hey {{first_name}}! Here is your access link: {{link}}`,
          buttonLabel: 'Claim Access',
          redirectUrl: 'https://masterclass.elenarostova.com',
        },
      ]);
      setActiveDmVersion(dmVariations.length);
    }
  };

  const handleSaveAutomation = () => {
    const payload = {
      title,
      isActive,
      triggerType,
      targetPostMode,
      selectedPostId,
      keywordMatchMode,
      keywordsList,
      checkFollower,
      followerPromptMsg,
      publicReplies,
      dmVariations,
      captureLead,
      leadFieldType,
      leadPromptText,
    };

    if (onSave) {
      onSave(payload);
    }
  };

  const currentDm = dmVariations[activeDmVersion] || dmVariations[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* 1. CANVAS HEADER */}
      <div className="p-5 rounded-2xl bg-white/90 border border-sky-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-20 z-30 backdrop-blur-md">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-sky-300 focus:border-sky-500 focus:outline-none w-full py-1"
            placeholder="Automation Name..."
          />
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span>Visual Flow Builder</span>
            <span>·</span>
            <span>Meta Graph API 2026</span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Active Switch Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {isActive ? 'Status: Active' : 'Status: Paused'}
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Button variant="brand" size="sm" onClick={handleSaveAutomation} className="gap-2 shadow-sm">
            <Check className="w-4 h-4 text-cyan-200" />
            <span>Save & Publish</span>
          </Button>
        </div>
      </div>

      {/* STEP 1: TRIGGER NODE (THE "WHEN") */}
      <Card className="p-6 border-sky-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              01
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Trigger Node: The "When"
              </h2>
              <p className="text-xs text-slate-500">
                Choose the Instagram interaction event that triggers the automation
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-sky-700 font-semibold bg-sky-50 px-2.5 py-1 rounded border border-sky-200">
            Instagram Webhook
          </span>
        </div>

        {/* Trigger Type Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Trigger Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'comment', label: 'Comments on Post/Reel', icon: MessageSquare, desc: 'Fires when a user leaves a comment' },
              { id: 'story_reply', label: 'Story Reply', icon: Send, desc: 'Fires when a user replies to your Story' },
              { id: 'mention', label: 'Direct Mention', icon: Instagram, desc: 'Fires when user mentions @your_handle' },
            ].map((t) => {
              const isSelected = triggerType === t.id;
              const IconComp = t.icon;
              return (
                <div
                  key={t.id}
                  onClick={() => setTriggerType(t.id as typeof triggerType)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-2 border-sky-500 bg-sky-50/60 ring-2 ring-sky-400/20'
                      : 'border-slate-200 hover:border-sky-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sky-700 mb-1">
                    <IconComp className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-900">{t.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{t.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post Selection */}
        {triggerType === 'comment' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Post / Reel
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetPostMode('ALL_POSTS')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    targetPostMode === 'ALL_POSTS'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  All Posts (Global)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPostMode('SPECIFIC')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    targetPostMode === 'SPECIFIC'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Specific Post
                </button>
              </div>
            </div>

            {targetPostMode === 'SPECIFIC' ? (
              <div className="grid grid-cols-3 gap-3">
                {MOCK_IG_POSTS.map((post) => {
                  const isSelected = selectedPostId === post.id;
                  return (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPostId(post.id)}
                      className={`relative rounded-xl overflow-hidden border-2 cursor-pointer aspect-square bg-slate-100 transition-all ${
                        isSelected
                          ? 'border-sky-500 ring-4 ring-sky-400/20 shadow-md'
                          : 'border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <img src={post.thumbnailUrl} alt="Post" className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-[10px] truncate">
                        {post.caption}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-center gap-2.5 text-xs text-sky-950 font-medium">
                <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                <span>This automation monitors comments across every existing and new post published on your profile.</span>
              </div>
            )}
          </div>
        )}

        {/* Keyword Rule Configuration */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Keyword Matching Rules
            </label>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Condition:</span>
              <select
                value={keywordMatchMode}
                onChange={(e) => setKeywordMatchMode(e.target.value as typeof keywordMatchMode)}
                className="py-1 px-2 rounded-lg border border-sky-200 bg-white font-semibold text-slate-800 text-xs"
              >
                <option value="contains">Contains keyword</option>
                <option value="exact">Exact match only</option>
                <option value="any">Any comment (no keyword needed)</option>
              </select>
            </div>
          </div>

          {keywordMatchMode !== 'any' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    #
                  </div>
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="Type keyword and hit Enter (e.g. guide, free, pdf)..."
                    className="pl-8 text-xs font-mono font-medium"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleAddKeyword} className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" />
                  <span>Add Keyword</span>
                </Button>
              </div>

              {/* Active Keywords Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {keywordsList.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-100 text-sky-800 font-mono text-xs font-bold border border-sky-200"
                  >
                    <span>#{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* STEP 2: CONDITION NODE (OPTIONAL FOLLOWER CHECK) */}
      <Card className="p-6 border-sky-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              02
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Condition Node: "Ask to Follow" (Optional)
              </h2>
              <p className="text-xs text-slate-500">
                Gate link delivery behind a real-time Instagram follower check
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Require Follow?</span>
            <Switch checked={checkFollower} onCheckedChange={setCheckFollower} />
          </div>
        </div>

        {checkFollower && (
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
              <UserCheck className="w-4 h-4 text-sky-600" />
              <span>Prompt for Non-Followers</span>
            </div>
            <Textarea
              value={followerPromptMsg}
              onChange={(e) => setFollowerPromptMsg(e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="Message sent if user does not follow you yet..."
            />
            <p className="text-[11px] text-slate-500">
              The moment the commenter follows your profile, LinktoDM instantly delivers their requested link.
            </p>
          </div>
        )}
      </Card>

      {/* STEP 3: ACTION NODE (THE "THEN") */}
      <Card className="p-6 border-sky-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              03
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Action Node: The "Then" (Public Reply & Smart DM Rotation)
              </h2>
              <p className="text-xs text-slate-500">
                Configure rotating comment replies and direct message button cards
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-teal-700 font-semibold bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
            Instagram Messaging API
          </span>
        </div>

        {/* Public Reply Section */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Automated Public Comment Replies ({publicReplies.length} variations)
          </label>
          <div className="flex gap-2">
            <Input
              value={newPublicReply}
              onChange={(e) => setNewPublicReply(e.target.value)}
              placeholder="Add another reply variation (e.g. 'Check your DMs! 🚀')..."
              className="text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleAddPublicReply} className="shrink-0 gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Add Reply</span>
            </Button>
          </div>

          <div className="space-y-1.5">
            {publicReplies.map((reply, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-slate-800">"{reply}"</span>
                <button
                  type="button"
                  onClick={() => handleRemovePublicReply(idx)}
                  className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Direct Message Sequence Block with Smart DM Rotation */}
        <div className="space-y-4 pt-4 border-t border-sky-100">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Direct Message Content (Smart DM Rotation)
              </label>
              <p className="text-[11px] text-slate-500">
                Rotate up to 10 copy variations to prevent spam flags from Meta.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddDmVariation}
              disabled={dmVariations.length >= 10}
              className="text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Variation ({dmVariations.length}/10)</span>
            </Button>
          </div>

          {/* Variation Tabs */}
          <div className="flex flex-wrap gap-2">
            {dmVariations.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDmVersion(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeDmVersion === idx
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Version {idx + 1}
              </button>
            ))}
          </div>

          {/* DM Editor for Active Version */}
          <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Message Body (Supports personalization tags)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...dmVariations];
                      updated[activeDmVersion].bodyText += ' {{first_name}}';
                      setDmVariations(updated);
                    }}
                    className="px-2 py-0.5 rounded bg-white border border-sky-200 font-mono text-[11px] text-sky-700 font-bold hover:bg-sky-50 cursor-pointer"
                  >
                    + {'{{first_name}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...dmVariations];
                      updated[activeDmVersion].bodyText += ' {{username}}';
                      setDmVariations(updated);
                    }}
                    className="px-2 py-0.5 rounded bg-white border border-sky-200 font-mono text-[11px] text-sky-700 font-bold hover:bg-sky-50 cursor-pointer"
                  >
                    + {'{{username}}'}
                  </button>
                </div>
              </div>

              <Textarea
                value={currentDm.bodyText}
                onChange={(e) => {
                  const updated = [...dmVariations];
                  updated[activeDmVersion].bodyText = e.target.value;
                  setDmVariations(updated);
                }}
                rows={4}
                className="text-xs font-sans"
              />
            </div>

            {/* Interactive Button Card Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Button CTA Label
                </label>
                <Input
                  value={currentDm.buttonLabel || ''}
                  onChange={(e) => {
                    const updated = [...dmVariations];
                    updated[activeDmVersion].buttonLabel = e.target.value;
                    setDmVariations(updated);
                  }}
                  placeholder="e.g. Watch Masterclass Free"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Redirect URL
                </label>
                <Input
                  value={currentDm.redirectUrl || ''}
                  onChange={(e) => {
                    const updated = [...dmVariations];
                    updated[activeDmVersion].redirectUrl = e.target.value;
                    setDmVariations(updated);
                  }}
                  placeholder="https://yourlink.com"
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 4: LEAD CAPTURE NODE (OPTIONAL CRM) */}
      <Card className="p-6 border-sky-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              04
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Lead Capture Node: In-Chat CRM Sync (Optional)
              </h2>
              <p className="text-xs text-slate-500">
                Automatically prompt users for their email or phone number in direct messages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Capture Leads?</span>
            <Switch checked={captureLead} onCheckedChange={setCaptureLead} />
          </div>
        </div>

        {captureLead && (
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Contact Field to Request:</span>
              <div className="flex gap-2">
                {['email', 'phone', 'both'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLeadFieldType(type as typeof leadFieldType)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                      leadFieldType === type
                        ? 'bg-sky-600 text-white'
                        : 'bg-white border border-sky-200 text-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chat Question Prompt:
              </label>
              <Input
                value={leadPromptText}
                onChange={(e) => setLeadPromptText(e.target.value)}
                placeholder="What email should I send your PDF to?"
                className="text-xs"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Captured contacts are instantly saved to your Leads table and can be exported as CSV or synced via webhook.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
