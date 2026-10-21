import React, { useEffect, useState } from 'react';
import { BioProfile, BioLink, ThemePreset } from '../../types';
import { THEME_PRESETS } from '../../data/mockData';
import { IconRenderer } from '../ui/IconRenderer';
import { Share2, Check, ExternalLink, Instagram } from 'lucide-react';

export interface PublicBioViewProps {
  profile: BioProfile;
  links: BioLink[];
  onPageView?: () => void;
  onLinkClick?: (linkId: string) => void;
  isStandalone?: boolean;
}

export const PublicBioView: React.FC<PublicBioViewProps> = ({
  profile,
  links,
  onPageView,
  onLinkClick,
  isStandalone = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [clickedLinkId, setClickedLinkId] = useState<string | null>(null);

  // Active theme lookup
  const currentTheme: ThemePreset =
    THEME_PRESETS.find((t) => t.id === profile.themeId) || THEME_PRESETS[0];

  // Analytics: Trigger Page View on mount
  useEffect(() => {
    if (onPageView) {
      onPageView();
    }
  }, [onPageView]);

  const handleLinkTap = (link: BioLink, e: React.MouseEvent) => {
    e.preventDefault();
    setClickedLinkId(link.id);
    if (onLinkClick) {
      onLinkClick(link.id);
    }
    setTimeout(() => {
      setClickedLinkId(null);
      // In real scenario, opens external window
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }, 280);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only render active links for public bio
  const activeLinks = links
    .filter((l) => l.isActive)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className={`min-h-full w-full transition-colors duration-300 flex flex-col items-center justify-between py-8 px-4 sm:px-6 relative ${currentTheme.backgroundClass}`}
    >
      {/* Top Action Bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-1">
        <a
          href={profile.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium tracking-tight opacity-80 hover:opacity-100 transition-opacity min-h-[44px] min-w-[44px]"
        >
          <Instagram className="w-4 h-4" />
          <span>@{profile.username}</span>
        </a>

        <button
          onClick={handleShare}
          className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-xs"
          aria-label="Share profile link"
          title="Share profile"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Bio Content */}
      <div className="w-full max-w-md flex flex-col items-center text-center space-y-6 flex-1">
        {/* Profile Avatar & Identity */}
        <div className="flex flex-col items-center space-y-3.5">
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 ring-2 ring-white/50 shadow-xl overflow-hidden bg-white/10">
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback container
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  if (target.parentElement) {
                    target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-indigo-600 text-white font-bold text-xl rounded-full">${profile.displayName.slice(0, 2).toUpperCase()}</div>`;
                  }
                }}
              />
            </div>
            {profile.verified && (
              <div
                title="Verified Instagram Creator"
                className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center ring-2 ring-white shadow-xs"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {profile.displayName}
            </h1>
            <p className={`text-xs font-medium tracking-wide ${currentTheme.subtextClass}`}>
              @{profile.username}
            </p>
          </div>

          <p
            className={`text-sm leading-relaxed max-w-sm px-2 font-normal ${currentTheme.subtextClass}`}
          >
            {profile.bio}
          </p>
        </div>

        {/* Links Stack */}
        <div className="w-full space-y-3 pt-2">
          {activeLinks.map((link) => {
            const isTapped = clickedLinkId === link.id;

            return (
              <a
                key={link.id}
                href={link.url}
                onClick={(e) => handleLinkTap(link, e)}
                className={`group relative flex items-center justify-between w-full min-h-[52px] sm:min-h-[56px] px-4 sm:px-5 py-3 rounded-2xl font-medium text-sm transition-all duration-200 cursor-pointer select-none active:scale-[0.97] ${
                  currentTheme.buttonClass
                } ${currentTheme.buttonHoverClass} ${
                  isTapped ? 'scale-[0.98] ring-2 ring-indigo-400' : ''
                }`}
              >
                {/* Left Icon with 36px bounding touch clearance */}
                <div className="w-8 h-8 rounded-xl bg-slate-100/40 dark:bg-slate-800/40 flex items-center justify-center shrink-0 mr-3">
                  <IconRenderer name={link.icon} className="w-4 h-4 shrink-0" />
                </div>

                {/* Center Title */}
                <span className="flex-1 text-center font-medium truncate pr-2 text-sm sm:text-base">
                  {link.title}
                </span>

                {/* Right Arrow / Action hint */}
                <div className="w-8 h-8 flex items-center justify-end shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </a>
            );
          })}

          {activeLinks.length === 0 && (
            <div className="py-12 px-4 rounded-2xl bg-white/10 backdrop-blur-sm text-center">
              <p className="text-sm opacity-75">No links published yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="pt-8 pb-4 text-center">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs opacity-60 hover:opacity-90 transition-opacity font-medium tracking-tight"
        >
          <span>InstaFlow</span>
          <span>·</span>
          <span>Bio & DM Automation</span>
        </a>
      </div>
    </div>
  );
};
