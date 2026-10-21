'use client';

import React, { useState } from 'react';
import { BioLinkBuilderView } from '@/src/components/views/BioLinkBuilderView';
import { INITIAL_PROFILE, INITIAL_LINKS } from '@/src/data/mockData';
import { BioProfile, BioLink } from '@/src/types';

export default function BioLinksPage() {
  const [profile, setProfile] = useState<BioProfile>(INITIAL_PROFILE);
  const [links, setLinks] = useState<BioLink[]>(INITIAL_LINKS);

  const handleUpdateProfile = (updated: Partial<BioProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  const handleAddLink = (newLinkData: Omit<BioLink, 'id' | 'clicks' | 'order'>) => {
    const newLink: BioLink = {
      ...newLinkData,
      id: `link-${Date.now()}`,
      clicks: 0,
      order: links.length + 1,
    };
    setLinks((prev) => [newLink, ...prev]);
  };

  const handleUpdateLink = (id: string, updated: Partial<BioLink>) => {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updated } : l))
    );
  };

  const handleDeleteLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleReorderLinks = (reordered: BioLink[]) => {
    setLinks(reordered);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <BioLinkBuilderView
          profile={profile}
          links={links}
          onUpdateProfile={handleUpdateProfile}
          onAddLink={handleAddLink}
          onUpdateLink={handleUpdateLink}
          onDeleteLink={handleDeleteLink}
          onReorderLinks={handleReorderLinks}
          onPreviewClick={() => {
            window.location.href = `/@${profile.username}`;
          }}
        />
      </div>
    </div>
  );
}
