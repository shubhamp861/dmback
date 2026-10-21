import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
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
  Layers,
  Activity,
  Flame,
} from 'lucide-react';
import { MOCK_IG_POSTS } from '../../data/mockData';

export interface PublicLandingViewProps {
  onRequireLogin: (featureName: string) => void;
  onExploreFeature: (tab: 'automations' | 'simulator' | 'events' | 'dashboard') => void;
}

export const PublicLandingView: React.FC<PublicLandingViewProps> = ({
  onRequireLogin,
  onExploreFeature,
}) => {
  const [activeFeatureTab, setActiveFeatureTab] = useState<'comment_to_dm' | 'dm_rotation' | 'ask_to_follow' | 'story_replies'>('comment_to_dm');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [simulatedComment, setSimulatedComment] = useState('guide');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

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
      a: 'Instead of sending 500 identical messages, LinktoDM rotates between up to 10 unique copy variations and dynamic tokens (such as {{first_name}} and {{username}}). This mimics natural human communication patterns and complies with Meta anti-spam policies.',
    },
    {
      q: 'Can I capture emails and phone numbers directly in chat?',
      a: 'Yes! Our Lead Capture node lets you prompt the commenter for their contact info inside the direct message dialogue and automatically syncs them into your built-in CRM or downloadable CSV.',
    },
    {
      q: 'Does it work for both Feed Posts and Instagram Reels?',
      a: 'Yes! You can attach automation rules to any specific post, viral Reel, or set rules to listen across all posts on your account simultaneously.',
    },
  ];

  return (
    <div className="space-y-20 pb-16 animate-in fade-in duration-300">
      {/* 1. HERO SECTION */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-4 sm:pt-8 px-4">
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
          Stop losing bio link clicks. Deliver instant direct messages with your links, digital products, and masterclass invitations whenever someone comments on your Reels or feed posts.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            variant="brand"
            size="lg"
            onClick={() => onRequireLogin('Instagram Account Connection')}
            className="gap-2.5 h-13 px-8 text-base font-semibold shadow-lg shadow-sky-500/25"
          >
            <Instagram className="w-5 h-5" />
            <span>Connect with Instagram (Free Trial)</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => onExploreFeature('simulator')}
            className="gap-2 h-13 px-6 text-sm font-medium"
          >
            <Play className="w-4 h-4 text-sky-600 fill-sky-600" />
            <span>Launch Live Simulator</span>
          </Button>
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

        {/* INTERACTIVE PREVIEW GRAPHIC (Simulating Comment Triggering Chat Bubble Sequence) */}
        <div className="mt-12 max-w-4xl mx-auto rounded-3xl border border-sky-200/90 bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-sky-900/5 text-left">
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

              {/* Keyword Trigger Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Try typing or selecting a trigger keyword:
                </label>
                <div className="flex items-center gap-2">
                  {['guide', 'course', 'presets', 'vip'].map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setSimulatedComment(kw)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        simulatedComment === kw
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white border border-sky-200 text-slate-600 hover:border-sky-400'
                      }`}
                    >
                      #{kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle: Webhook Connector Animation */}
            <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white flex items-center justify-center shadow-md animate-bounce">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono text-sky-700 mt-2 font-bold tracking-tight">
                0.8s dispatch
              </span>
            </div>

            {/* Right: Instagram DM Chat Dialogue */}
            <div className="md:col-span-5 rounded-2xl border border-sky-200 bg-white p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center">
                    IG
                  </div>
                  <span className="text-xs font-bold text-slate-900">elena.creates</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded font-semibold">
                  Direct Message
                </span>
              </div>

              {/* Chat Bubble Sequence */}
              <div className="space-y-2 text-xs">
                {/* Bubble 1 */}
                <div className="p-3 rounded-2xl rounded-tl-sm bg-sky-50 border border-sky-100 text-slate-800 leading-relaxed">
                  Hey Alex! ✨ Thanks for your comment on my latest Reel!
                </div>

                {/* Bubble 2 with Action Card */}
                <div className="p-3.5 rounded-2xl rounded-tl-sm bg-gradient-to-br from-sky-600 to-cyan-600 text-white space-y-2 shadow-sm">
                  <p className="leading-snug">
                    Here is your exclusive link to download the <strong>{simulatedComment.toUpperCase()}</strong>:
                  </p>
                  <div className="p-2.5 rounded-xl bg-white text-slate-900 text-[11px] font-semibold flex items-center justify-between shadow-xs">
                    <span className="truncate">Download {simulatedComment.toUpperCase()} PDF</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-400 pt-1">
                Delivered instantly via Meta Graph API
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SOCIAL PROOF & TRUST SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-sky-100 p-8 shadow-sm">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y lg:divide-y-0 lg:divide-x divide-sky-100">
            <div className="space-y-1 p-2">
              <div className="flex items-center justify-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-2xl font-extrabold text-slate-900 font-mono">4.9 / 5.0</p>
              <p className="text-xs text-slate-500">Rated by 4,200+ Creators</p>
            </div>

            <div className="space-y-1 p-2">
              <p className="text-2xl font-extrabold text-sky-600 font-mono">1.8M+</p>
              <p className="text-sm font-bold text-slate-800">DMs Dispatched</p>
              <p className="text-xs text-slate-500">In 2026 across 38 countries</p>
            </div>

            <div className="space-y-1 p-2">
              <p className="text-2xl font-extrabold text-cyan-600 font-mono">99.8%</p>
              <p className="text-sm font-bold text-slate-800">Inbox Delivery Rate</p>
              <p className="text-xs text-slate-500">Zero spam filter flags</p>
            </div>

            <div className="space-y-1 p-2 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 text-sky-700 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <span>Meta Business Partner</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Official Graph API & Webhook Compliance
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURE GRID SECTION (Interactive Tabs) */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2.5 py-1 rounded-md">
            Product Capabilities
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Engineered for Creators & Fast-Moving Brands
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Everything you need to automate conversations, capture leads, and convert comments without violating Meta rate limits.
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-sky-50/80 rounded-2xl border border-sky-100 max-w-3xl mx-auto">
          {featureTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFeatureTab(tab.id as typeof activeFeatureTab)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeFeatureTab === tab.id
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Active Feature Tab Card */}
        <Card className="p-8 border-sky-200/90 bg-white shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>{currentTab.stats}</span>
              </div>

              <h3 className="text-2xl font-bold text-slate-900">
                {currentTab.title}
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">
                {currentTab.description}
              </p>

              <div className="space-y-3 pt-2">
                {currentTab.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <Button
                  variant="brand"
                  size="md"
                  onClick={() => onRequireLogin(currentTab.name)}
                  className="gap-2"
                >
                  <span>Build with {currentTab.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Visual Preview Side for Active Tab */}
            <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50/40 to-white p-5 border border-sky-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-xs font-bold text-slate-900">Engine Preview</span>
                <span className="text-[10px] font-mono text-sky-600 font-bold">READY</span>
              </div>

              {activeFeatureTab === 'comment_to_dm' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                    <p className="font-semibold text-slate-800">Trigger Conditions</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Comment contains keyword: <code className="text-sky-700 font-bold font-mono">#guide</code></p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                    <p className="font-semibold text-slate-800">Public Reply</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">"Sent you a DM with the link! 📩"</p>
                  </div>
                </div>
              )}

              {activeFeatureTab === 'dm_rotation' && (
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-sky-100 shadow-2xs">
                    <span className="text-[10px] font-mono font-bold text-sky-600">VARIATION A</span>
                    <p className="text-slate-700 text-[11px] mt-0.5">"Hey &#123;&#123;first_name&#125;&#125;! Here is your requested link: [Link]"</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-sky-100 shadow-2xs">
                    <span className="text-[10px] font-mono font-bold text-cyan-600">VARIATION B</span>
                    <p className="text-slate-700 text-[11px] mt-0.5">"So excited to share this! Check out the guide here: [Link]"</p>
                  </div>
                </div>
              )}

              {activeFeatureTab === 'ask_to_follow' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">Follower Gate Status</p>
                      <p className="text-slate-500 text-[11px]">Meta Graph API follower verify</p>
                    </div>
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="p-3 bg-sky-50 rounded-xl text-sky-800 text-[11px] font-medium leading-relaxed">
                    Follower receives: "Thanks for asking! Please follow @elena.creates to unlock your masterclass ticket ✨"
                  </div>
                </div>
              )}

              {activeFeatureTab === 'story_replies' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                    <p className="font-semibold text-slate-800">Story Reshares</p>
                    <p className="text-slate-500 text-[11px]">Instant automated coupon for fans who tag you</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                    <p className="font-semibold text-slate-800">Quick Emoji Reactions</p>
                    <p className="text-slate-500 text-[11px]">Engage flame or heart emoji reactions with high-converting links</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* 4. PRICING TIERS */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2.5 py-1 rounded-md">
            Transparent Pricing
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Simple, High-ROI Plans for Every Creator
          </h2>
          <p className="text-sm text-slate-500">
            All plans include official Meta Graph API connection and unlimited campaign triggers.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="pt-2 flex items-center justify-center gap-3">
            <span className={`text-xs font-semibold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}>
              Monthly
            </span>
            <button
              type="button"
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className="w-12 h-6 rounded-full bg-sky-600 p-0.5 transition-colors relative cursor-pointer"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-semibold ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-500'}`}>
              Annual <span className="text-sky-600 font-bold text-[10px] bg-sky-50 px-1.5 py-0.5 rounded">Save 20%</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tier 1: Starter */}
          <Card className="p-6 border-sky-100 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Starter</h3>
                <p className="text-xs text-slate-500 mt-1">For budding creators building their first audience.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'annual' ? '24' : '29'}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 pt-2 border-t border-sky-100">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>1 Instagram Business account</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Up to 1,000 automated DMs / mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>3 active automation rules</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>3 message variations rotation</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              size="md"
              onClick={() => onRequireLogin('Starter Plan')}
              className="w-full text-xs"
            >
              Get Started with Starter
            </Button>
          </Card>

          {/* Tier 2: Pro (Featured) */}
          <Card className="p-6 border-2 border-sky-500 ring-4 ring-sky-400/10 bg-white relative flex flex-col justify-between space-y-6 shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Most Popular
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pro Creator</h3>
                <p className="text-xs text-slate-500 mt-1">For creators & businesses with high daily comments.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'annual' ? '49' : '59'}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 pt-2 border-t border-sky-100">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span><strong>3 Instagram Business accounts</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span><strong>Unlimited automated DMs</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Unlimited automation campaigns</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Up to 10 smart DM rotations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>"Ask to Follow" growth gate</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Story reply & mention triggers</span>
                </li>
              </ul>
            </div>

            <Button
              variant="brand"
              size="md"
              onClick={() => onRequireLogin('Pro Plan')}
              className="w-full text-xs font-semibold shadow-md shadow-sky-500/20"
            >
              Start 14-Day Free Pro Trial
            </Button>
          </Card>

          {/* Tier 3: Agency */}
          <Card className="p-6 border-sky-100 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Agency & Teams</h3>
                <p className="text-xs text-slate-500 mt-1">For marketing agencies managing client Instagram brands.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'annual' ? '119' : '149'}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700 pt-2 border-t border-sky-100">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>10+ Instagram Business accounts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Multi-seat team workspace permissions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Dedicated IP & priority Webhooks</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Custom CRM webhooks & CSV exports</span>
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              size="md"
              onClick={() => onRequireLogin('Agency Plan')}
              className="w-full text-xs"
            >
              Contact Agency Sales
            </Button>
          </Card>
        </div>
      </section>

      {/* 5. FAQS SECTION */}
      <section id="faqs" className="max-w-3xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Got questions about Meta compliance, setup, and spam avoidance?
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-sky-200/80 bg-white overflow-hidden transition-all shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : index)}
                  className="w-full p-4.5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-slate-900 hover:text-sky-700 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-sky-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4.5 pb-4.5 text-xs text-slate-600 leading-relaxed border-t border-sky-50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. SAAS FOOTER */}
      <footer className="border-t border-sky-100 pt-12 pb-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-sky-500 to-cyan-500 flex items-center justify-center text-white">
                <Snowflake className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-slate-900 text-sm">
                Link<span className="text-sky-600">to</span>DM
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              High-converting Instagram comment-to-DM automation software built on official Meta Graph APIs.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900 mb-2">Product</p>
            <ul className="space-y-1.5 text-[11px]">
              <li><button onClick={() => onExploreFeature('automations')} className="hover:text-slate-900 cursor-pointer">Comment-to-DM</button></li>
              <li><button onClick={() => onExploreFeature('simulator')} className="hover:text-slate-900 cursor-pointer">Live Simulator</button></li>
              <li><button onClick={() => onExploreFeature('dashboard')} className="hover:text-slate-900 cursor-pointer">Analytics Dashboard</button></li>
              <li><button onClick={() => onExploreFeature('events')} className="hover:text-slate-900 cursor-pointer">Trigger Outbox</button></li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-slate-900 mb-2">Meta Compliance</p>
            <ul className="space-y-1.5 text-[11px]">
              <li>Official Instagram Graph API</li>
              <li>24-Hour Messaging Policy</li>
              <li>HMAC-SHA256 Webhook Verification</li>
              <li>Anti-Spam DM Variation Engine</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-slate-900 mb-2">Legal & Trust</p>
            <ul className="space-y-1.5 text-[11px]">
              <li className="hover:text-slate-900 cursor-pointer">Privacy Policy</li>
              <li className="hover:text-slate-900 cursor-pointer">Terms of Service</li>
              <li className="hover:text-slate-900 cursor-pointer">Data Processing Agreement</li>
              <li className="hover:text-slate-900 cursor-pointer">Security Standards</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-sky-100/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© 2026 LinktoDM Inc. All rights reserved.</p>
          <p>This product uses the Instagram Graph API but is not endorsed or certified by Meta Platforms, Inc.</p>
        </div>
      </footer>
    </div>
  );
};
