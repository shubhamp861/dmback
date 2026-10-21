import React, { useState } from 'react';
import { DMAutomationCampaign, IGPost } from '../../types';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Card } from '../ui/Card';
import {
  Sparkles,
  Grid,
  Globe,
  AlertCircle,
  Check,
  Zap,
  Play,
  Copy,
  MessageCircle,
} from 'lucide-react';

export interface CreateCampaignSheetProps {
  isOpen: boolean;
  onClose: () => void;
  posts: IGPost[];
  onSaveCampaign: (campaign: Omit<DMAutomationCampaign, 'id' | 'dmSentCount' | 'createdAt'>) => void;
}

const MAX_DM_CHARS = 1000;

export const CreateCampaignSheet: React.FC<CreateCampaignSheetProps> = ({
  isOpen,
  onClose,
  posts,
  onSaveCampaign,
}) => {
  const [name, setName] = useState('');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [dmMessage, setDmMessage] = useState(
    'Hey there! ✨ Thanks for leaving a comment on my post! Here is your exclusive link: {link}\n\nLet me know if you have any questions!'
  );
  const [triggerOnAllPosts, setTriggerOnAllPosts] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>(posts[0]?.id || '');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Keyword sanitization: force lowercase, remove special characters and spaces
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = raw
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // strip spaces, punctuation, symbols
    setTriggerKeyword(sanitized);
    if (formErrors.keyword) {
      setFormErrors((prev) => ({ ...prev, keyword: '' }));
    }
  };

  const handleInsertTag = (tag: string) => {
    setDmMessage((prev) => `${prev} ${tag}`);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Campaign name is required';
    if (!triggerKeyword.trim()) errors.keyword = 'Trigger keyword is required';
    if (!actionUrl.trim()) errors.actionUrl = 'Action URL is required';
    if (!dmMessage.trim()) errors.dmMessage = 'DM message body cannot be empty';
    if (!triggerOnAllPosts && !selectedPostId) errors.post = 'Please select a post or check ALL posts';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let formattedUrl = actionUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const selectedPost = posts.find((p) => p.id === selectedPostId);

    onSaveCampaign({
      name: name.trim(),
      triggerKeyword: triggerKeyword.trim(),
      actionUrl: formattedUrl,
      dmMessage: dmMessage.trim(),
      postId: triggerOnAllPosts ? 'ALL_POSTS' : selectedPostId,
      postThumbnailUrl: triggerOnAllPosts ? undefined : selectedPost?.thumbnailUrl,
      postCaption: triggerOnAllPosts ? 'Applies to ALL current & future posts' : selectedPost?.caption,
      isActive: true,
    });

    // Reset & close
    setName('');
    setTriggerKeyword('');
    setActionUrl('');
    setTriggerOnAllPosts(false);
    onClose();
  };

  const selectedPost = posts.find((p) => p.id === selectedPostId);
  const charCount = dmMessage.length;
  const isNearLimit = charCount > MAX_DM_CHARS * 0.85;
  const isOverLimit = charCount > MAX_DM_CHARS;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Create Instagram DM Automation"
      description="Automatically send a private Direct Message whenever someone comments a specific keyword on your posts."
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-slate-500">
            Instagram API compliant · Instant 1-second delivery
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={handleSubmit}
              disabled={isOverLimit}
            >
              <Zap className="w-4 h-4 mr-1.5 text-amber-300" />
              Publish Automation
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
            Campaign Name
          </label>
          <Input
            placeholder="e.g. Masterclass VIP Guide Drop"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (formErrors.name) setFormErrors((p) => ({ ...p, name: '' }));
            }}
            error={formErrors.name}
          />
        </div>

        {/* Post Selection Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Trigger Post Selection
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer min-h-[32px]">
              <input
                type="checkbox"
                checked={triggerOnAllPosts}
                onChange={(e) => setTriggerOnAllPosts(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
              />
              <span>Trigger on ALL posts (Account-wide)</span>
            </label>
          </div>

          {!triggerOnAllPosts ? (
            <div>
              <p className="text-xs text-slate-500 mb-2.5">
                Choose the Instagram post where followers leave comments:
              </p>
              <div className="grid grid-cols-3 gap-3">
                {posts.map((post) => {
                  const isSelected = selectedPostId === post.id;
                  return (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPostId(post.id)}
                      className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-square bg-slate-100 ${
                        isSelected
                          ? 'border-sky-500 ring-4 ring-sky-400/20 shadow-md'
                          : 'border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <img
                        src={post.thumbnailUrl}
                        alt="Instagram Post"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white text-[11px] font-medium leading-tight">
                        <p className="line-clamp-2">{post.caption}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {formErrors.post && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{formErrors.post}</p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-center gap-3">
              <Globe className="w-5 h-5 text-sky-600 shrink-0" />
              <p className="text-xs text-sky-950 font-medium">
                This keyword rule will monitor comments across <strong>any existing or new post</strong> published on your Instagram profile.
              </p>
            </div>
          )}
        </div>

        {/* Trigger Keyword (Clean formatting enforced) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Trigger Keyword
            </label>
            <span className="text-[11px] text-slate-500">
              Only letters & numbers (lowercase)
            </span>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">
              #
            </div>
            <Input
              value={triggerKeyword}
              onChange={handleKeywordChange}
              placeholder="e.g. guide, course, presets"
              className="pl-8 font-mono font-medium"
              error={formErrors.keyword}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Example: If a user comments <em>"Please send me the <strong>{triggerKeyword || 'guide'}</strong>!"</em>, the DM will fire automatically.
          </p>
        </div>

        {/* Linked Action URL */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
            Destination / Action URL
          </label>
          <Input
            value={actionUrl}
            onChange={(e) => {
              setActionUrl(e.target.value);
              if (formErrors.actionUrl) setFormErrors((p) => ({ ...p, actionUrl: '' }));
            }}
            placeholder="https://elenarostova.com/masterclass"
            error={formErrors.actionUrl}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Replaces the <code>{'{link}'}</code> variable inside your DM message.
          </p>
        </div>

        {/* DM Response Box (Rich Textarea + Char Counter) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Outbound Instagram DM Message
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono tabular-nums ${
                  isOverLimit
                    ? 'text-rose-600 font-bold'
                    : isNearLimit
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}
              >
                {charCount}/{MAX_DM_CHARS} chars
              </span>
            </div>
          </div>

          <Textarea
            value={dmMessage}
            onChange={(e) => {
              setDmMessage(e.target.value);
              if (formErrors.dmMessage) setFormErrors((p) => ({ ...p, dmMessage: '' }));
            }}
            rows={4}
            className="font-sans text-sm"
            error={
              formErrors.dmMessage ||
              (isOverLimit ? 'Message exceeds Instagram character limit' : undefined)
            }
          />

          {/* Quick Token Insert Buttons */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-slate-500">Insert variable:</span>
            <button
              type="button"
              onClick={() => handleInsertTag('{link}')}
              className="px-2 py-1 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-mono text-sky-700 font-semibold cursor-pointer transition-colors"
            >
              {'{link}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertTag('{name}')}
              className="px-2 py-1 rounded-md bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-xs font-mono text-cyan-700 font-semibold cursor-pointer transition-colors"
            >
              {'{name}'}
            </button>
          </div>

          {/* Char counter warning alert block */}
          {isNearLimit && !isOverLimit && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Approaching Instagram recommended DM length. Keep it concise for mobile readability.</span>
            </div>
          )}

          {isOverLimit && (
            <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200/80 flex items-center gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Message is over the 1,000 character limit. Instagram will truncate or fail delivery.</span>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
};
