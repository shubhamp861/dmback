import React, { useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Instagram,
  Shield,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AVATAR_URL } from '../../data/mockData';

export interface InstagramLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (accountInfo: {
    username: string;
    displayName: string;
    avatarUrl: string;
    igUserId: string;
  }) => void;
  featureAttempted?: string;
}

export const InstagramLoginModal: React.FC<InstagramLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  featureAttempted,
}) => {
  const [customHandle, setCustomHandle] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleQuickConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      onLoginSuccess({
        username: 'elena.creates',
        displayName: 'Elena Rostova',
        avatarUrl: AVATAR_URL,
        igUserId: 'local-ig-account',
      });
      setConnecting(false);
      onClose();
    }, 600);
  };

  const handleCustomConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = customHandle.trim().replace(/^@/, '').toLowerCase();
    if (!handle) return;

    setConnecting(true);
    setTimeout(() => {
      onLoginSuccess({
        username: handle,
        displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
        avatarUrl: AVATAR_URL,
        igUserId: `ig-${handle}-984`,
      });
      setConnecting(false);
      onClose();
    }, 600);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Connect with Instagram"
      description={
        featureAttempted
          ? `Sign in with your Instagram Professional account to access ${featureAttempted}.`
          : 'Sign in to access your automated DM campaigns and comment triggers.'
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-6">
        {/* Meta / Instagram Branding Badge */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50/50 to-white border border-sky-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Instagram Professional</p>
              <p className="text-[11px] text-slate-500">Official Graph API Connection</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-semibold bg-white px-2 py-1 rounded-md border border-sky-200 text-sky-800">
            OAuth 2.0
          </span>
        </div>

        {/* Permissions Scope Disclosure */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
            Requested Permissions
          </span>
          <div className="space-y-2 text-xs text-slate-600 bg-sky-50/40 p-3.5 rounded-xl border border-sky-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Listen to comments on feed posts & Reels</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Dispatch automated Direct Messages for matched keywords</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Read basic public profile and post media</span>
            </div>
          </div>
        </div>

        {/* Quick Connect Account Card */}
        {!isCustomMode ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl border border-sky-200/80 bg-white shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full ring-2 ring-sky-300 overflow-hidden bg-slate-100">
                  <img
                    src={AVATAR_URL}
                    alt="Elena Rostova"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900">elena.creates</span>
                    <CheckCircle2 className="w-3 h-3 text-sky-500 fill-sky-500 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-400">84.2K Followers · Creator Account</span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="brand"
              onClick={handleQuickConnect}
              disabled={connecting}
              className="w-full h-11 text-sm gap-2"
            >
              <Instagram className="w-4 h-4" />
              <span>
                {connecting ? 'Connecting...' : 'Continue as @elena.creates'}
              </span>
            </Button>

            <button
              type="button"
              onClick={() => setIsCustomMode(true)}
              className="w-full text-center text-xs text-slate-500 hover:text-sky-700 font-medium py-1 transition-colors cursor-pointer"
            >
              Sign in with a different Instagram account &rarr;
            </button>
          </div>
        ) : (
          /* Custom Instagram Handle Form */
          <form onSubmit={handleCustomConnect} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter Instagram Handle
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  @
                </div>
                <Input
                  value={customHandle}
                  onChange={(e) => setCustomHandle(e.target.value)}
                  placeholder="your.handle"
                  className="pl-8 text-xs font-medium"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="brand"
              disabled={connecting}
              className="w-full h-11 text-sm gap-2"
            >
              <Instagram className="w-4 h-4" />
              <span>{connecting ? 'Authenticating...' : 'Connect This Account'}</span>
            </Button>

            <button
              type="button"
              onClick={() => setIsCustomMode(false)}
              className="w-full text-center text-xs text-slate-500 hover:text-sky-700 font-medium py-1 transition-colors cursor-pointer"
            >
              &larr; Back to default creator account
            </button>
          </form>
        )}

        {/* Security disclaimer */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-2 border-t border-sky-100">
          <Lock className="w-3.5 h-3.5" />
          <span>Your credentials and access tokens are securely encrypted.</span>
        </div>
      </div>
    </Sheet>
  );
};
