import React, { useState } from 'react';
import { BioLink, BioProfile } from '../../types';
import { THEME_PRESETS } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { IconRenderer, AVAILABLE_ICONS } from '../ui/IconRenderer';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Palette,
  ExternalLink,
  User,
  Sparkles,
  Check,
  MousePointerClick,
  GripVertical,
} from 'lucide-react';

export interface BioLinkBuilderViewProps {
  profile: BioProfile;
  links: BioLink[];
  onUpdateProfile: (updated: Partial<BioProfile>) => void;
  onAddLink: (link: Omit<BioLink, 'id' | 'clicks' | 'order'>) => void;
  onUpdateLink: (id: string, updated: Partial<BioLink>) => void;
  onDeleteLink: (id: string) => void;
  onReorderLinks: (reordered: BioLink[]) => void;
  onPreviewClick: () => void;
}

export const BioLinkBuilderView: React.FC<BioLinkBuilderViewProps> = ({
  profile,
  links,
  onUpdateProfile,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onReorderLinks,
  onPreviewClick,
}) => {
  // Quick Add Link state
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [addError, setAddError] = useState('');

  // Editing profile state
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(profile.displayName);
  const [tempBio, setTempBio] = useState(profile.bio);

  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setAddError('Please enter a link title');
      return;
    }
    if (!newUrl.trim()) {
      setAddError('Please enter a destination URL');
      return;
    }

    let formattedUrl = newUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    onAddLink({
      title: newTitle.trim(),
      url: formattedUrl,
      icon: newIcon,
      isActive: true,
    });

    setNewTitle('');
    setNewUrl('');
    setNewIcon('Sparkles');
    setAddError('');
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= links.length) return;

    const newLinks = [...links];
    const [moved] = newLinks.splice(index, 1);
    newLinks.splice(targetIndex, 0, moved);

    // Reassign order
    const ordered = newLinks.map((item, idx) => ({ ...item, order: idx + 1 }));
    onReorderLinks(ordered);
  };

  const handleSaveProfile = () => {
    onUpdateProfile({
      displayName: tempDisplayName,
      bio: tempBio,
    });
    setShowProfileEditor(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bio Link Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Build, rearrange, and toggle active links shown on your Instagram bio profile.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProfileEditor(!showProfileEditor)}
            className="gap-2"
          >
            <User className="w-4 h-4 text-slate-500" />
            <span>Edit Profile Info</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={onPreviewClick}
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4 text-slate-300" />
            <span>Open Live Bio</span>
          </Button>
        </div>
      </div>

      {/* Profile Info Collapse Editor */}
      {showProfileEditor && (
        <Card className="bg-slate-50 border-indigo-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Customize Instagram Bio Header</span>
            </h3>
            <span className="text-xs text-slate-500">@{profile.username}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Display Name
              </label>
              <Input
                value={tempDisplayName}
                onChange={(e) => setTempDisplayName(e.target.value)}
                placeholder="Elena Rostova"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Instagram Handle
              </label>
              <Input
                value={`@${profile.username}`}
                disabled
                className="bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bio Text Paragraph
            </label>
            <Textarea
              value={tempBio}
              onChange={(e) => setTempBio(e.target.value)}
              rows={2}
              placeholder="Tell visitors what to expect..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProfileEditor(false)}
            >
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleSaveProfile}>
              Save Profile Changes
            </Button>
          </div>
        </Card>
      )}

      {/* QUICK ADD ROW */}
      <Card className="border-indigo-100 shadow-xs p-5 bg-gradient-to-b from-white to-indigo-50/20">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Quick Add New Bio Link
          </h2>
        </div>

        <form onSubmit={handleCreateLink} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            {/* Title Input */}
            <div className="sm:col-span-5">
              <Input
                placeholder="Link Title (e.g. Free Masterclass)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                error={addError && !newTitle ? 'Title required' : undefined}
              />
            </div>

            {/* URL Input */}
            <div className="sm:col-span-4">
              <Input
                placeholder="https://yourlink.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                error={addError && !newUrl ? 'URL required' : undefined}
              />
            </div>

            {/* Icon picker dropdown */}
            <div className="sm:col-span-2">
              <div className="relative">
                <select
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
                >
                  {AVAILABLE_ICONS.map((ic) => (
                    <option key={ic.name} value={ic.name}>
                      {ic.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Link Button */}
            <div className="sm:col-span-1">
              <Button
                type="submit"
                variant="brand"
                className="w-full h-11 min-h-[44px]"
                title="Add Link"
              >
                <Plus className="w-4 h-4" />
                <span className="sm:hidden text-xs">Add</span>
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* THEME SELECTOR BAR */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Public Theme Appearance
            </h3>
          </div>
          <span className="text-xs text-slate-500">Live preview reflects immediately</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {THEME_PRESETS.map((preset) => {
            const isSelected = profile.themeId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdateProfile({ themeId: preset.id })}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-left cursor-pointer min-h-[70px] ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div
                  className={`w-full h-8 rounded-lg shadow-inner ${preset.previewBg} flex items-center justify-center`}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                </div>
                <span className="text-xs font-medium text-slate-800 truncate w-full text-center">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* MANAGE ACTIVE LINKS LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Active Bio Links ({links.length})
            </h2>
            <p className="text-xs text-slate-500">
              Use reorder controls to adjust button sequence on your live page.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {links.map((link, index) => (
            <Card
              key={link.id}
              className={`p-4 transition-all ${
                link.isActive
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Drag handle & sequence */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveLink(index, 'up')}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer rounded"
                      title="Move Up"
                      aria-label="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === links.length - 1}
                      onClick={() => moveLink(index, 'down')}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer rounded"
                      title="Move Down"
                      aria-label="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <IconRenderer name={link.icon} className="w-5 h-5" />
                  </div>

                  {/* Inline Editable Fields */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.title}
                        onChange={(e) => onUpdateLink(link.id, { title: e.target.value })}
                        className="text-sm font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none w-full py-0.5"
                        placeholder="Link title..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) => onUpdateLink(link.id, { url: e.target.value })}
                        className="text-xs text-slate-500 font-mono bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none w-full py-0.5"
                        placeholder="Destination URL..."
                      />
                    </div>
                  </div>
                </div>

                {/* Right Controls: Clicks counter, Visibility Switch, Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Click counter badge */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-medium"
                    title={`${link.clicks} clicks recorded`}
                  >
                    <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />
                    <span className="tabular-nums font-semibold">{link.clicks.toLocaleString()}</span>
                    <span className="text-slate-400 font-sans">clicks</span>
                  </div>

                  {/* Active Visibility Switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 hidden sm:inline">
                      {link.isActive ? 'Visible' : 'Hidden'}
                    </span>
                    <Switch
                      checked={link.isActive}
                      onCheckedChange={(checked) => onUpdateLink(link.id, { isActive: checked })}
                      ariaLabel={`Toggle visibility for ${link.title}`}
                    />
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => onDeleteLink(link.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    title="Delete link"
                    aria-label={`Delete ${link.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
