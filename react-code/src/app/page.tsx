'use client';

import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import {
  Instagram,
  Sparkles,
  Zap,
  MessageSquare,
  Send,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Play,
  RotateCcw,
  UserCheck,
  HelpCircle,
  Star,
  ExternalLink,
  Snowflake,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { MOCK_IG_POSTS } from '@/src/data/mockData';

export interface MarketingLandingPageProps {
  onConnectInstagram?: () => void;
  onNavigateToDashboard?: () => void;
}

export default function MarketingLandingPage({
  onConnectInstagram,
  onNavigateToDashboard,
}: MarketingLandingPageProps) {
  const [activeFeatureTab, setActiveFeatureTab] = useState<'comment_to_dm' | 'dm_rotation' | 'ask_to_follow' | 'story_replies'>('comment_to_dm');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [simulatedComment, setSimulatedComment] = useState('guide');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const handleAction = () => {
    if (onConnectInstagram) {
      onConnectInstagram();
    } else if (onNavigateToDashboard) {
      onNavigateToDashboard();
    } else {
      window.location.href = '/dashboard';
    }
  };

  const featureTabs = [
    {
      id: 'comment_to_dm',
      name: 'Comment-to-DM',
      title: 'Instant Keyword Triggers on Posts & Reels',
      description: 'Automatically detect when followers comment your designated keywords and deliver links in under 1 second.',
      stats: '1s Average Delivery',
      bullets: [
        'Supports exact match, contains keyword, or any comment',
        'Works on both standard feed photo posts and viral Instagram Reels',
        'Auto-cleans punctuation and lowercase formatting',
      ],
    },
    {
      id: 'dm_rotation',
      name: 'Smart DM Rotation',
      title: 'Rotate Up to 10 Variations to Bypass Spam Filters',
      description: 'Never trigger Instagram spam thresholds by rotating distinct copy, emojis, and greetings for every outbound message.',
      stats: 'Zero Account Flags',
      bullets: [
        'A/B test different CTAs and button labels',
        'Dynamic personalization tags ({{first_name}}, {{username}})',
        'Seamless fallbacks if a recipient has strict message request filters',
      ],
    },
    {
      id: 'ask_to_follow',
      name: 'Ask to Follow',
      title: 'Require or Encourage Users to Follow Before Links',
      description: 'Skyrocket your follower growth by prompting non-followers to hit "Follow" before receiving their VIP download link.',
      stats: '+42% Follower Conversion',
      bullets: [
        'Real-time follower status check using Meta Graph API',
        'Polite automated nudge: "Follow @account to unlock your free link"',
        'Instant unlock the moment they hit follow',
      ],
    },
    {
      id: 'story_replies',
      name: 'Story & Mention Replies',
      title: 'Automate Story Mentions & Quick Reactions',
      description: 'Engage audience members who tag your handle in their Stories or send reaction emojis with custom automated sequences.',
      stats: '24/7 Engagement',
      bullets: [
        'Instant thank-you notes for Story reshares',
        'Direct coupon drops when fans tag your product in their Stories',
        '24-hour customer care window compliance',
      ],
    },
  ];

  const currentTab = featureTabs.find((t) => t.id === activeFeatureTab) || featureTabs[0];

  const faqs = [
    {
      q: 'Is this automation safe and compliant with Instagram & Meta rules?',
      a: 'Yes, 100%. LinktoDM connects exclusively through the official Meta Graph API and Instagram Messaging API. We strictly honor Meta rate limits and the standard 24-hour messaging window so your account is never at risk of shadowbans.',
    },
    {
      q: 'Do I need an Instagram Business or Creator account?',
      a: 'Yes. Meta requires an Instagram Professional account (either Business or Creator) connected to a Facebook Page to access the official Messaging API. Personal profiles do not support official API automation.',
    },
    {
      q: 'How does Smart DM Rotation prevent spam detection?',
      a: 'Instead of sending 500 identical messages, LinktoDM rotates between up to 10 unique copy variations and dynamic tokens (such as {{first_name}} and {{username}}). This mimics natural human communication patterns.',
    },
    {
      q: 'Can I capture emails and phone numbers directly in chat?',
      a: 'Yes! Our Lead Capture node lets you prompt the commenter for their contact info inside the direct message dialogue and automatically syncs them into your built-in CRM or downloadable CSV.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f1f7fc] text-slate-900 selection:bg-sky-200">
      {/* 1. STICKY TOP NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-sky-100 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-500 to-teal-400 flex items-center justify-center text-white shadow-xs shadow-cyan-500/20">
              <Snowflake className="w-4 h-4" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Link<span className="text-sky-600">to</span>DM
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-xs lg:text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </a>
            <a href="#demo" className="hover:text-slate-900 transition-colors">
              Live Demo
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              Pricing
            </a>
            <a href="#faqs" className="hover:text-slate-900 transition-colors">
              FAQs
            </a>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleAction}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1.5 cursor-pointer hidden sm:block"
            >
              Sign In
            </button>
            <Button
              variant="brand"
              size="sm"
              onClick={handleAction}
              className="gap-2 shadow-sm shadow-sky-500/20 whitespace-nowrap"
            >
              <Instagram className="w-4 h-4" />
              <span className="hidden sm:inline">Connect with Instagram</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-xs font-semibold text-sky-800 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Official Meta Graph API Integration · 100% Spam-Free</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Turn Instagram Comments and Stories Into{' '}
            <span className="bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-500 bg-clip-text text-transparent">
              Automated Sales & Leads
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Stop losing bio link clicks. Send instant direct messages with your links, digital products, and masterclass invitations whenever someone comments on your Reels or feed posts.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="brand"
              size="lg"
              onClick={handleAction}
              className="gap-2.5 h-13 px-8 text-base font-semibold shadow-lg shadow-sky-500/25"
            >
              <Instagram className="w-5 h-5" />
              <span>Connect with Instagram (Free Trial)</span>
            </Button>

            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 h-13 px-6 rounded-xl border border-sky-200 bg-white/90 font-medium text-sm text-slate-700 hover:bg-sky-50 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 text-sky-600 fill-sky-600" />
              <span>See Interactive Preview</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" /> Official Meta Tech Partner
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" /> 1-second webhook response
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" /> No password required
            </span>
          </div>
        </div>

        {/* INTERACTIVE PREVIEW GRAPHIC (Simulating Comment Triggering Chat Bubble Sequence) */}
        <div id="demo" className="mt-14 max-w-4xl mx-auto rounded-3xl border border-sky-200/90 bg-white/90 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-sky-900/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-sky-100">
            <div>
              <span className="text-xs font-mono font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2 py-0.5 rounded">
                Live Interactive Simulation
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Test the Follower Comment-to-DM Trigger
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Meta Graph Webhook Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-6 items-center">
            {/* Left: Comment Simulation */}
            <div className="md:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white font-bold text-[10px] flex items-center justify-center">
                    AL
                  </div>
                  <span className="text-xs font-bold text-slate-900">follower_alex</span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-sky-200/80 text-xs text-slate-800 shadow-2xs">
                  <span className="text-slate-400">Leaves comment: </span>
                  <strong className="text-sky-700">"Please send the {simulatedComment}!"</strong>
                </div>
              </div>

              {/* Keyword options */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Switch Trigger Keyword:</span>
                <div className="flex flex-wrap gap-2">
                  {['guide', 'free', 'pdf', 'masterclass'].map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setSimulatedComment(kw)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                        simulatedComment === kw
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white border border-sky-200 text-slate-700 hover:bg-sky-50'
                      }`}
                    >
                      #{kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle: Fast Arrow */}
            <div className="hidden md:flex md:col-span-2 justify-center text-sky-500">
              <div className="flex flex-col items-center gap-1">
                <Zap className="w-5 h-5 text-amber-500 animate-bounce" />
                <span className="text-[10px] font-mono font-bold text-sky-700">0.8s</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            {/* Right: Inbound DM Received */}
            <div className="md:col-span-5 space-y-3">
              <div className="rounded-2xl border border-sky-200 bg-white p-4 shadow-md space-y-2.5">
                <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
                      DM
                    </div>
                    <span className="text-xs font-bold text-slate-900">your_creator_account</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                    Delivered
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-800 leading-relaxed">
                  Hey Alex! ✨ Thanks for your comment! Here is your private access link to the {simulatedComment.toUpperCase()}:
                  <div className="mt-2.5 p-2 rounded-lg bg-white border border-sky-300 font-mono text-[10px] text-sky-700 font-bold truncate flex items-center justify-between">
                    <span>https://creator.link/{simulatedComment}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF & TRUST SECTION */}
      <section className="py-12 border-y border-sky-100/90 bg-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-3xl font-extrabold text-slate-900 font-mono">1.8M+</div>
              <p className="text-xs text-slate-500 font-medium">Automated DMs Dispatched</p>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-extrabold text-sky-600 font-mono">99.4%</div>
              <p className="text-xs text-slate-500 font-medium">Delivery Success Rate</p>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-extrabold text-slate-900 font-mono">4.9 / 5</div>
              <div className="flex justify-center text-amber-400 gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-extrabold text-slate-900 font-mono">0 Flags</div>
              <p className="text-xs text-slate-500 font-medium">Meta Terms & API Compliant</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURE GRID SECTION (INTERACTIVE TABS) */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2.5 py-1 rounded">
            Feature Breakdown
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900">
            Engineered to Convert Every Comment into a Lead
          </h2>
          <p className="text-sm text-slate-500">
            Interactive automations designed exclusively for Instagram creators and scaling e-commerce brands.
          </p>
        </div>

        {/* Tab Selection Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-sky-100/60 rounded-2xl max-w-2xl mx-auto border border-sky-200/80">
          {featureTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFeatureTab(tab.id as typeof activeFeatureTab)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFeatureTab === tab.id
                  ? 'bg-white text-sky-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Active Tab Spotlight Card */}
        <Card className="p-8 sm:p-10 border-sky-200/90 bg-white shadow-lg shadow-sky-900/5 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-5">
              <div className="inline-block text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                {currentTab.stats}
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                {currentTab.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {currentTab.description}
              </p>

              <div className="space-y-2.5 pt-2">
                {currentTab.bullets.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <Button variant="brand" size="sm" onClick={handleAction} className="gap-2">
                  <span>Build This Automation</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="md:col-span-5 p-6 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center mx-auto shadow-sm">
                <Zap className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Zero Code Required</h4>
              <p className="text-xs text-slate-500">
                Connect your account in 30 seconds and activate your first keyword campaign without leaving the browser.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* 5. PRICING TIERS */}
      <section id="pricing" className="py-20 border-t border-sky-100 bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2.5 py-1 rounded">
              Transparent Pricing
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900">
              Simple, Predictable Plans for Every Stage
            </h2>
            <p className="text-sm text-slate-500">
              Try free for 14 days. Scale as your Instagram audience grows.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 ${
                  billingCycle === 'annual'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1 rounded">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Tier 1: Starter */}
            <Card className="p-7 space-y-6 flex flex-col justify-between hover:border-sky-300 transition-all">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Starter Creator</h3>
                  <p className="text-xs text-slate-500 mt-1">For growing personal brands & creators</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    ${billingCycle === 'monthly' ? '29' : '23'}
                  </span>
                  <span className="text-xs text-slate-500">/ month</span>
                </div>
                <div className="space-y-2.5 pt-2 border-t border-sky-100 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Up to 1,500 automated DMs / month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>1 Instagram Business account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Smart DM Rotation (up to 3 variations)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Instant comment replies</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleAction}>
                Start 14-Day Free Trial
              </Button>
            </Card>

            {/* Tier 2: Pro (Featured) */}
            <Card className="p-7 space-y-6 flex flex-col justify-between border-2 border-sky-500 shadow-xl shadow-sky-500/10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                Most Popular
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Pro Business</h3>
                  <p className="text-xs text-slate-500 mt-1">For scaling creators, educators & direct brands</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    ${billingCycle === 'monthly' ? '79' : '63'}
                  </span>
                  <span className="text-xs text-slate-500">/ month</span>
                </div>
                <div className="space-y-2.5 pt-2 border-t border-sky-100 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span><strong>15,000 automated DMs / month</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Up to 3 Instagram Business accounts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Full 10-variation Smart DM rotation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span><strong>Ask-to-Follow Gate & CRM Lead Capture</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Story & Mention automated responses</span>
                  </div>
                </div>
              </div>
              <Button variant="brand" className="w-full shadow-md" onClick={handleAction}>
                Claim 14-Day Pro Trial
              </Button>
            </Card>

            {/* Tier 3: Agency */}
            <Card className="p-7 space-y-6 flex flex-col justify-between hover:border-sky-300 transition-all">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Agency & Scale</h3>
                  <p className="text-xs text-slate-500 mt-1">For marketing agencies managing multiple clients</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    ${billingCycle === 'monthly' ? '199' : '159'}
                  </span>
                  <span className="text-xs text-slate-500">/ month</span>
                </div>
                <div className="space-y-2.5 pt-2 border-t border-sky-100 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Unlimited automated DMs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>10+ Instagram Business accounts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Multi-workspace team permissions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Dedicated webhooks & replay priority</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleAction}>
                Contact Sales
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION SECTION */}
      <section id="faqs" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2.5 py-1 rounded">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-sky-100 bg-white overflow-hidden shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 text-sm cursor-pointer hover:bg-sky-50/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-sky-50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. SAAS FOOTER */}
      <footer className="border-t border-sky-200/80 bg-white/90 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Snowflake className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-900 text-sm">LinktoDM</span>
            <span>·</span>
            <span>Instagram Comment-to-DM SaaS</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</a>
            <a href="/meta-compliance" className="hover:text-slate-900 transition-colors">Meta Compliance</a>
          </div>

          <p className="text-slate-400">
            &copy; 2026 LinktoDM Inc. All rights reserved. Not affiliated with Instagram or Meta.
          </p>
        </div>
      </footer>
    </div>
  );
}
