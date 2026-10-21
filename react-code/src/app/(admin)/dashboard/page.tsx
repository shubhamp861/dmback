'use client';

import React, { useState } from 'react';
import { DashboardOverviewView } from '@/src/components/views/DashboardOverviewView';
import {
  INITIAL_CAMPAIGNS,
  MOCK_IG_POSTS,
  MOCK_ANALYTICS_30D,
} from '@/src/data/mockData';

export default function AdminDashboardPage() {
  const [campaigns] = useState(INITIAL_CAMPAIGNS);
  const [posts] = useState(MOCK_IG_POSTS);
  const [analytics] = useState(MOCK_ANALYTICS_30D);

  const handleNavigateTab = (tab: 'automations' | 'simulator' | 'events') => {
    if (typeof window !== 'undefined') {
      window.location.href = `/${tab}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardOverviewView
          campaigns={campaigns}
          posts={posts}
          analyticsData={analytics}
          onNavigateTab={handleNavigateTab}
          onOpenCreateCampaign={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/automations';
            }
          }}
        />
      </div>
    </div>
  );
}
