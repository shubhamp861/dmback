import React, { useEffect, useState } from 'react';
import {
  INITIAL_CAMPAIGNS,
  MOCK_IG_POSTS,
  MOCK_ANALYTICS_30D,
  INITIAL_PROFILE,
} from './data/mockData';
import { DMAutomationCampaign, AnalyticsDay } from './types';
import {
  SEEDED_IG_ACCOUNT,
  SEEDED_TRIGGER_EVENTS,
  AuthUser,
  InstagramAccount,
  authApi,
  ApiError,
  TriggerEvent,
  ReplayResponse,
} from './lib/api';
import { PublicLandingView } from './components/views/PublicLandingView';
import { DashboardOverviewView } from './components/views/DashboardOverviewView';
import { AutomationsView } from './components/views/AutomationsView';
import { LiveSimulatorView } from './components/views/LiveSimulatorView';
import { TriggerEventsView } from './components/views/TriggerEventsView';
import { CreateCampaignSheet } from './components/views/CreateCampaignSheet';
import { InstagramLoginModal } from './components/views/InstagramLoginModal';
import { AuthModal } from './components/views/AuthModal';
import { Button } from './components/ui/Button';
import {
  LayoutDashboard,
  Zap,
  Play,
  Activity,
  CheckCircle,
  Shield,
  Plus,
  Snowflake,
  Instagram,
  LogOut,
  Sparkles,
  Menu,
  X,
  User,
} from 'lucide-react';

export interface ConnectedInstagramUser {
  username: string;
  displayName: string;
  avatarUrl: string;
  igUserId: string;
}

export default function App() {
  // Email authentication owns the app session. Instagram connection is tracked separately.
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [connectedUser, setConnectedUser] = useState<ConnectedInstagramUser | null>(null);

  // Active navigation tab: 'features' | 'dashboard' | 'automations' | 'simulator' | 'events'
  const [activeTab, setActiveTab] = useState<'features' | 'dashboard' | 'automations' | 'simulator' | 'events'>('features');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [featureAttempted, setFeatureAttempted] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // App State: Instagram Comment-to-DM campaigns & event outbox
  const [campaigns, setCampaigns] = useState<DMAutomationCampaign[]>(INITIAL_CAMPAIGNS);
  const [events, setEvents] = useState<TriggerEvent[]>(SEEDED_TRIGGER_EVENTS);
  const [analytics] = useState<AnalyticsDay[]>(MOCK_ANALYTICS_30D);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isLoggedIn = currentUser !== null;

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const response = await authApi.me();
        if (!cancelled) {
          setCurrentUser(response.data);
        }
      } catch (error) {
        const apiError = error as ApiError;
        if (!cancelled && apiError.code !== 'UNAUTHENTICATED') {
          showToast('Unable to restore your email session');
        }
        if (!cancelled) setCurrentUser(null);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setAccounts([]);
      return;
    }

    void authApi.accounts()
      .then((response) => setAccounts(response.data))
      .catch(() => setAccounts([]));
  }, [currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Guard for protected features: the email session authenticates app access.
  const requireLogin = (featureName: string, targetTab?: 'dashboard' | 'automations' | 'simulator' | 'events') => {
    if (!isLoggedIn) {
      setFeatureAttempted(featureName);
      setIsAuthModalOpen(true);
      return false;
    }
    if (targetTab) {
      setActiveTab(targetTab);
    }
    return true;
  };

  const handleTabClick = (tab: 'features' | 'dashboard' | 'automations' | 'simulator' | 'events') => {
    if (tab === 'features') {
      setActiveTab('features');
      return;
    }

    const featureNames = {
      dashboard: 'Analytics Dashboard',
      automations: 'DM Automations Manager',
      simulator: 'Live Comment Simulator',
      events: 'Trigger Events & Outbox',
    };

    if (requireLogin(featureNames[tab], tab)) {
      setActiveTab(tab);
    }
  };

  const handleInstagramConnection = (account: ConnectedInstagramUser) => {
    setConnectedUser(account);
    showToast(`Connected as @${account.username}`);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local state even when the server session is already unavailable.
    }
    setCurrentUser(null);
    setAccounts([]);
    setConnectedUser(null);
    setActiveTab('features');
    showToast('Logged out of LinktoDM');
  };

  const handleEmailLogin = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setCurrentUser(response.data);
    setActiveTab(featureAttempted ? 'dashboard' : activeTab);
  };

  const handleSignupRequestOtp = async (email: string) => {
    await authApi.signupRequestOtp(email);
  };

  const handleSignupVerifyOtp = async (email: string, otp: string) => {
    const response = await authApi.signupVerifyOtp(email, otp);
    return response.data.verificationToken;
  };

  const handleSignupComplete = async (verificationToken: string, password: string, workspaceName: string) => {
    const response = await authApi.signupComplete(verificationToken, password, workspaceName);
    setCurrentUser(response.data);
    setActiveTab('dashboard');
  };

  const handleRequestReset = async (email: string) => {
    await authApi.requestReset(email);
  };

  const handleAddCampaign = (
    newCampData: Omit<DMAutomationCampaign, 'id' | 'dmSentCount' | 'createdAt'>
  ) => {
    const newCampaign: DMAutomationCampaign = {
      ...newCampData,
      id: `camp-${Date.now()}`,
      dmSentCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCampaigns((prev) => [newCampaign, ...prev]);
    showToast(`Automation campaign "${newCampaign.name}" published!`);
  };

  const handleToggleCampaign = (id: string, active: boolean) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: active } : c))
    );
    showToast(active ? 'DM rule activated' : 'DM rule paused');
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    showToast('Automation campaign deleted');
  };

  const handleTriggerDM = (campaignId: string) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaignId ? { ...c, dmSentCount: c.dmSentCount + 1 } : c))
    );

    const targetCamp = campaigns.find((c) => c.id === campaignId);

    // Create realistic new trigger event in outbox
    const newEvent: TriggerEvent = {
      id: `evt-${Date.now()}`,
      ig_account_id: connectedUser?.igUserId || 'local-ig-account',
      automation_id: campaignId,
      comment_id: `ig_cmt_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      comment_text: `Test comment matching #${targetCamp?.triggerKeyword}`,
      matched_keyword: targetCamp?.triggerKeyword || 'guide',
      outcome: 'queued',
      reason_code: null,
      attempts: 1,
      created_at: new Date().toISOString(),
      sent_at: null,
    };
    setEvents((prev) => [newEvent, ...prev]);
    showToast('Simulated Instagram DM dispatched (+1 to outbox)');
  };

  const handleReplayWebhook = async (eventId: string): Promise<ReplayResponse> => {
    showToast(`Audited replay requested for event ${eventId.slice(0, 8)}...`);
    return {
      id: `replay-${Date.now()}`,
      webhookEventId: eventId,
      status: 'pending',
    };
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 pb-16 md:pb-0">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl border border-sky-400/20">
            <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ICE BASE THEME TOP BAR: Zone 1 (Wordmark) - Zone 2 (Nav links) - Zone 3 (Primary action / Login / Logout) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-sky-100/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
          {/* Zone 1: Ice Brand Wordmark */}
          <div
            onClick={() => {
              setActiveTab('features');
              setIsMobileNavOpen(false);
            }}
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-cyan-500 to-teal-400 flex items-center justify-center text-white shadow-xs shadow-cyan-500/25 group-hover:scale-105 transition-transform shrink-0">
              <Snowflake className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
                Link<span className="text-sky-600">to</span>DM
              </span>
              <span className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-50 text-sky-700 border border-sky-200/70">
                Meta Partner
              </span>
            </div>
          </div>

          {/* Zone 2: Desktop Navigation Links (Segmented Pill Layout that never wraps or squishes) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-sky-100 text-xs font-medium">
            <button
              onClick={() => handleTabClick('features')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'features'
                  ? 'bg-white text-sky-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Overview
            </button>

            <button
              onClick={() => handleTabClick('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-white text-sky-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => handleTabClick('automations')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'automations'
                  ? 'bg-white text-sky-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Automations
            </button>

            <button
              onClick={() => handleTabClick('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'bg-white text-sky-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Play className="w-3 h-3 text-cyan-600 shrink-0" />
              <span>Simulator</span>
            </button>

            <button
              onClick={() => handleTabClick('events')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'events'
                  ? 'bg-white text-sky-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Activity className="w-3 h-3 text-cyan-600 shrink-0" />
              <span>Events</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action / Login / Logout State + Mobile Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {!isLoggedIn ? (
              /* Logged Out State: email session sign-in */
              <Button
                variant="brand"
                size="sm"
                onClick={() => {
                  setIsAuthModalOpen(true);
                }}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm shadow-sm shadow-sky-500/20 whitespace-nowrap px-2.5 sm:px-3.5"
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Sign in</span>
                <span className="sm:hidden">Sign in</span>
              </Button>
            ) : (
              /* Logged In State: email account + separate Instagram connection */
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  title="Signed-in email account"
                  className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-sky-200/80 bg-white/95 shadow-2xs"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {currentUser?.email.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-slate-900 max-w-[120px] sm:max-w-none truncate hidden xs:inline">
                    {currentUser?.email}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInstagramModalOpen(true)}
                  className="gap-1 px-2 text-xs text-slate-600 hover:text-sky-700 hover:bg-sky-50"
                  title="Connect Instagram account"
                >
                  <Instagram className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Instagram</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-1 px-2 text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                  title="Log out of Instagram"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Log Out</span>
                </Button>
              </div>
            )}

            {/* Mobile / Tablet Nav Drawer Toggle Button */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-sky-100/90 shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isMobileNavOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Dropdown Menu */}
        {isMobileNavOpen && (
          <div className="lg:hidden border-t border-sky-100 bg-white/95 backdrop-blur-md px-3 sm:px-6 py-3 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                onClick={() => {
                  handleTabClick('features');
                  setIsMobileNavOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors ${
                  activeTab === 'features'
                    ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => {
                  handleTabClick('dashboard');
                  setIsMobileNavOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => {
                  handleTabClick('automations');
                  setIsMobileNavOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors ${
                  activeTab === 'automations'
                    ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Zap className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Automations</span>
              </button>

              <button
                onClick={() => {
                  handleTabClick('simulator');
                  setIsMobileNavOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors ${
                  activeTab === 'simulator'
                    ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Play className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Simulator</span>
              </button>

              <button
                onClick={() => {
                  handleTabClick('events');
                  setIsMobileNavOpen(false);
                }}
                className={`col-span-2 flex items-center gap-2 p-2.5 rounded-xl text-left transition-colors ${
                  activeTab === 'events'
                    ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Trigger Events & Webhook Outbox</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* VIEW 0: Public Landing & Feature Showcase (Home screen that displays features without forcing prompt) */}
        {activeTab === 'features' && (
          <PublicLandingView
            onRequireLogin={(feat) => {
              setFeatureAttempted(feat);
              setIsAuthModalOpen(true);
            }}
            onExploreFeature={(tab) => handleTabClick(tab)}
          />
        )}

        {/* VIEW 1: Dashboard (Protected) */}
        {activeTab === 'dashboard' && isLoggedIn && (
          <DashboardOverviewView
            campaigns={campaigns}
            posts={MOCK_IG_POSTS}
            analyticsData={analytics}
            onNavigateTab={(tab) => handleTabClick(tab)}
            onOpenCreateCampaign={() => setIsCreateOpen(true)}
          />
        )}

        {/* VIEW 2: Automations Manager (Protected) */}
        {activeTab === 'automations' && isLoggedIn && (
          <AutomationsView
            campaigns={campaigns}
            posts={MOCK_IG_POSTS}
            profile={INITIAL_PROFILE}
            userRole="owner"
            onAddCampaign={handleAddCampaign}
            onToggleCampaign={handleToggleCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onTriggerDM={handleTriggerDM}
            onReplayWebhook={handleReplayWebhook}
          />
        )}

        {/* VIEW 3: Live Simulator (Protected / Try it) */}
        {activeTab === 'simulator' && isLoggedIn && (
          <LiveSimulatorView
            campaigns={campaigns}
            posts={MOCK_IG_POSTS}
            onTriggerDM={handleTriggerDM}
            onOpenCreateCampaign={() => setIsCreateOpen(true)}
          />
        )}

        {/* VIEW 4: Trigger Events & Outbox (Protected) */}
        {activeTab === 'events' && isLoggedIn && (
          <TriggerEventsView
            events={events}
            userRole="owner"
            onReplayWebhook={handleReplayWebhook}
          />
        )}
      </main>

      {/* MOBILE BOTTOM TAB BAR */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-sky-100 pb-safe">
        <div className="grid grid-cols-4 items-center h-16 px-1">
          <button
            onClick={() => handleTabClick('features')}
            className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'features' ? 'text-sky-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1">Features</span>
          </button>

          <button
            onClick={() => handleTabClick('dashboard')}
            className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'dashboard' ? 'text-sky-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1">Dashboard</span>
          </button>

          <button
            onClick={() => handleTabClick('automations')}
            className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'automations' ? 'text-sky-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1">Rules</span>
          </button>

          <button
            onClick={() => handleTabClick('simulator')}
            className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'simulator' ? 'text-sky-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <Play className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1">Simulator</span>
          </button>
        </div>
      </div>

       {/* Email authentication modal */}
       <AuthModal
         isOpen={isAuthModalOpen}
         onClose={() => setIsAuthModalOpen(false)}
         currentUser={currentUser}
         accounts={accounts}
         onLogin={handleEmailLogin}
         onSignupRequestOtp={handleSignupRequestOtp}
         onSignupVerifyOtp={handleSignupVerifyOtp}
         onSignupComplete={handleSignupComplete}
         onLogout={handleLogout}
         onRequestReset={handleRequestReset}
       />

       {/* Separate Instagram connection surface; it never creates the app email session. */}
       <InstagramLoginModal
         isOpen={isInstagramModalOpen}
         onClose={() => setIsInstagramModalOpen(false)}
         onLoginSuccess={handleInstagramConnection}
         featureAttempted={featureAttempted}
       />

      {/* Create Campaign Modal */}
      <CreateCampaignSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        posts={MOCK_IG_POSTS}
        onSaveCampaign={handleAddCampaign}
      />
    </div>
  );
}
