import React, { useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AuthUser, InstagramAccount } from '../../lib/api';
import {
  User,
  Shield,
  Instagram,
  Lock,
  Mail,
  Building,
  CheckCircle2,
  LogOut,
  ExternalLink,
  KeyRound,
  AlertCircle,
} from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  accounts: InstagramAccount[];
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, workspaceName: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onRequestReset: (email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accounts,
  onLogin,
  onSignup,
  onLogout,
  onRequestReset,
}) => {
  const [mode, setMode] = useState<'profile' | 'login' | 'signup' | 'reset'>('profile');
  const [email, setEmail] = useState('developer@example.local');
  const [password, setPassword] = useState('local-development-password');
  const [workspaceName, setWorkspaceName] = useState('My Creator Studio');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await onLogin(email, password);
        onClose();
      } else if (mode === 'signup') {
        await onSignup(email, password, workspaceName);
        onClose();
      } else if (mode === 'reset') {
        await onRequestReset(email);
        setResetMessage('If an account exists for this email, reset instructions have been recorded.');
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string; fields?: Record<string, string[]> };
      setError(apiErr?.message || 'Authentication operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstagram = () => {
    // In live mode navigates to /v1/auth/instagram/start
    const url = 'http://127.0.0.1:3000/v1/auth/instagram/start';
    if (window.confirm('Initiate Instagram OAuth connection via GET /v1/auth/instagram/start?')) {
      window.location.assign(url);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        currentUser
          ? 'Workspace & Authentication Profile'
          : mode === 'login'
          ? 'Log In to LinktoDM'
          : mode === 'signup'
          ? 'Create New Workspace'
          : 'Reset Password'
      }
      description={
        currentUser
          ? 'Session authenticated with secure HttpOnly cookie and CSRF agreement.'
          : 'Backend authentication via cookie sessions (/v1/auth).'
      }
      maxWidth="max-w-lg"
    >
      {/* State A: Authenticated User Profile */}
      {currentUser && mode === 'profile' ? (
        <div className="space-y-6">
          {/* User & Role Badge */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                {currentUser.email.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{currentUser.email}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  ID: {currentUser.id.slice(0, 18)}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-semibold text-indigo-700 capitalize">
              <Shield className="w-3.5 h-3.5" />
              <span>{currentUser.role}</span>
            </div>
          </div>

          {/* Workspace Details */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Workspace Context
            </label>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-mono text-slate-700 truncate max-w-[220px]">
                  {currentUser.workspaceId}
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
              </span>
            </div>
          </div>

          {/* Connected Instagram Accounts (/v1/ig-accounts) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Connected Instagram Accounts
              </label>
              <button
                type="button"
                onClick={handleConnectInstagram}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>Connect Account</span>
              </button>
            </div>

            <div className="space-y-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        @{acc.username}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {acc.accountType} · {acc.status}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-100">
                    {acc.igUserId}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await onLogout();
                setMode('login');
              }}
              className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </Button>

            <Button variant="default" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        /* State B: Login / Signup / Password Reset Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resetMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resetMessage}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Workspace Name
              </label>
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="My Brand Studio"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.local"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Password (min 12 characters)
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-xs text-indigo-600 hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>
          )}

          <Button type="submit" variant="brand" className="w-full mt-2" disabled={loading}>
            {loading
              ? 'Processing...'
              : mode === 'login'
              ? 'Sign In to Workspace'
              : mode === 'signup'
              ? 'Create Account & Workspace'
              : 'Send Reset Instructions'}
          </Button>

          {/* Mode Switchers */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'login' && (
              <p>
                Don't have a workspace?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Create workspace
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p>
                Remembered password?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </form>
      )}
    </Sheet>
  );
};
