'use client';

import React, { useState } from 'react';
import { AutomationsView } from '@/src/components/views/AutomationsView';
import {
  INITIAL_CAMPAIGNS,
  MOCK_IG_POSTS,
  INITIAL_PROFILE,
} from '@/src/data/mockData';
import { DMAutomationCampaign } from '@/src/types';

export default function AutomationsPage() {
  const [campaigns, setCampaigns] = useState<DMAutomationCampaign[]>(INITIAL_CAMPAIGNS);
  const [posts] = useState(MOCK_IG_POSTS);
  const [profile] = useState(INITIAL_PROFILE);

  const handleAddCampaign = (
    newCampData: Omit<DMAutomationCampaign, 'id' | 'dmSentCount' | 'createdAt'>
  ) => {
    const newCamp: DMAutomationCampaign = {
      ...newCampData,
      id: `camp-${Date.now()}`,
      dmSentCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCampaigns((prev) => [newCamp, ...prev]);
  };

  const handleToggleCampaign = (id: string, active: boolean) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: active } : c))
    );
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  const handleTriggerDM = (campaignId: string) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaignId ? { ...c, dmSentCount: c.dmSentCount + 1 } : c))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <AutomationsView
          campaigns={campaigns}
          posts={posts}
          profile={profile}
          onAddCampaign={handleAddCampaign}
          onToggleCampaign={handleToggleCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          onTriggerDM={handleTriggerDM}
        />
      </div>
    </div>
  );
}
