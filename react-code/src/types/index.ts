export type ThemePreset = {
  id: string;
  name: string;
  category: 'gradient' | 'solid' | 'dark';
  backgroundClass: string;
  buttonClass: string;
  buttonHoverClass: string;
  textClass: string;
  subtextClass: string;
  previewBg: string;
};

export interface BioLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  isActive: boolean;
  clicks: number;
  order: number;
}

export interface BioProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  themeId: string;
  instagramUrl: string;
  viewsCount: number;
  totalClicks: number;
  followersCount: number;
}

export interface IGPost {
  id: string;
  caption: string;
  thumbnailUrl: string;
  likes: number;
  comments: number;
  date: string;
}

export interface DMAutomationCampaign {
  id: string;
  name: string;
  triggerKeyword: string;
  actionUrl: string;
  dmMessage: string;
  postId: string; // 'ALL_POSTS' or specific IG post ID
  postThumbnailUrl?: string;
  postCaption?: string;
  dmSentCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface AnalyticsDay {
  date: string;
  dayLabel: string;
  views: number;
  clicks: number;
  dms: number;
  ctr: number;
}
