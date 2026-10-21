import React from 'react';
import { BioProfile, BioLink } from '../../types';
import { PublicBioView } from './PublicBioView';
import { Smartphone, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '../ui/Button';

export interface LiveBioPreviewPaneProps {
  profile: BioProfile;
  links: BioLink[];
  onPageView: () => void;
  onLinkClick: (linkId: string) => void;
  onOpenStandalone: () => void;
}

export const LiveBioPreviewPane: React.FC<LiveBioPreviewPaneProps> = ({
  profile,
  links,
  onPageView,
  onLinkClick,
  onOpenStandalone,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://instaflow.me/@${profile.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Top Device Bar */}
      <div className="flex items-center justify-between w-full max-w-[340px] mb-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <Smartphone className="w-4 h-4 text-slate-400" />
          <span>Mobile Device Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyUrl}
            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Bio URL</span>
              </>
            )}
          </button>
          <span>·</span>
          <button
            onClick={onOpenStandalone}
            className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Full Page</span>
          </button>
        </div>
      </div>

      {/* Simulated Smartphone Shell */}
      <div className="relative w-full max-w-[340px] h-[640px] bg-slate-900 rounded-[44px] p-3 shadow-2xl ring-1 ring-slate-800/80 ring-offset-2 flex flex-col overflow-hidden">
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-4 inset-x-0 mx-auto w-24 h-5 bg-black rounded-full z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800/80 mr-4" />
          <div className="w-2 h-2 rounded-full bg-indigo-950" />
        </div>

        {/* Screen Bezel Inside */}
        <div className="relative w-full h-full rounded-[34px] overflow-hidden overflow-y-auto bg-slate-50 flex flex-col scrollbar-none">
          {/* Status Bar simulation */}
          <div className="h-9 w-full flex items-center justify-between px-6 pt-1 text-[10px] font-semibold text-slate-900 z-10 shrink-0 select-none opacity-80">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px]">5G</span>
              <div className="w-4 h-2 rounded-xs border border-current p-0.5 flex items-center">
                <div className="w-full h-full bg-current rounded-xs" />
              </div>
            </div>
          </div>

          {/* Actual Public Bio Page View inside device frame */}
          <div className="flex-1 overflow-y-auto">
            <PublicBioView
              profile={profile}
              links={links}
              onPageView={onPageView}
              onLinkClick={onLinkClick}
            />
          </div>

          {/* Mobile Home Bar indicator */}
          <div className="h-4 w-full flex items-center justify-center shrink-0 pb-1">
            <div className="w-28 h-1 bg-slate-400/50 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
