'use client';

import React, { useState } from 'react';
import { PublicBioView } from '@/src/components/views/PublicBioView';
import { INITIAL_PROFILE, INITIAL_LINKS } from '@/src/data/mockData';
import { BioProfile, BioLink } from '@/src/types';

export default function PublicBioPage({ params }: { params?: { username: string } }) {
  const [profile, setProfile] = useState<BioProfile>({
    ...INITIAL_PROFILE,
    username: params?.username || INITIAL_PROFILE.username,
  });
  const [links, setLinks] = useState<BioLink[]>(INITIAL_LINKS);

  const handlePageView = () => {
    // In production, call tracking API endpoint
    console.log(`[Analytics] Tracked page view for @${profile.username}`);
  };

  const handleLinkClick = (linkId: string) => {
    console.log(`[Analytics] Tracked link click on linkId: ${linkId}`);
    setLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, clicks: l.clicks + 1 } : l))
    );
  };

  return (
    <main className="min-h-screen w-full flex flex-col bg-slate-100">
      <PublicBioView
        profile={profile}
        links={links}
        onPageView={handlePageView}
        onLinkClick={handleLinkClick}
        isStandalone={true}
      />
    </main>
  );
}
