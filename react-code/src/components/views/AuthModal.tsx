import React, { useEffect, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { API_BASE_URL, AuthUser, formatApiError, InstagramAccount } from '../../lib/api';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Instagram,
  LogOut,
  Shield,
} from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

type AuthMode = 'profile' | 'login' | 'signup' | 'reset';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  accounts: InstagramAccount[];
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleSignIn: (credential: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onRequestReset: (email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accounts,
  onLogin,
  onGoogleSignIn,
  onLogout,
  onRequestReset,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setMode(currentUser ? 'profile' : 'login');
    setPassword('');
    setError(null);
    setResetMessage(null);
  }, [isOpen, currentUser]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setResetMessage(null);
  };

  const handleGoogleCredential = async (credential: string) => {
    setError(null);
    setLoading(true);

    try {
      await onGoogleSignIn(credential);
      onClose();
    } catch (err: unknown) {
      setError(formatApiError(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
        onClose();
      } else if (mode === 'reset') {
        await onRequestReset(email.trim());
        setResetMessage('If an account exists for this email, reset instructions have been recorded.');
      }
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstagram = () => {
    const url = `${API_BASE_URL}/v1/auth/instagram/start`;
    if (window.confirm('Continue to Instagram to connect a professional account?')) {
      window.location.assign(url);
    }
  };

  const title = currentUser
    ? 'Workspace & Authentication Profile'
    : mode === 'login'
    ? 'Log In to LinktoDM'
    : mode === 'signup'
    ? 'Create Your Workspace'
    : 'Reset Password';

  const description = currentUser
    ? 'Your email session is active. Instagram is connected separately to this workspace.'
    : mode === 'signup'
    ? 'Continue with Google to create your account and workspace. No password or email code is required.'
    : 'Email authentication via secure cookie sessions (/v1/auth).';

  const errorBanner = error ? (
    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  ) : null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth="max-w-lg"
    >
      {currentUser && mode === 'profile' ? (
        <div className="space-y-6">
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
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                        <Instagram className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">@{account.username}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {account.accountType || 'Instagram'} · {account.status}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-100">
                      {account.igUserId}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-slate-400" />
                  No Instagram account is connected yet.
                </div>
              )}
            </div>
          </div>

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
      ) : mode === 'signup' ? (
        <div className="space-y-5">
          {errorBanner}

          {GOOGLE_CLIENT_ID ? (
            <div className="space-y-3">
              {loading ? (
                <p className="py-3 text-center text-xs text-slate-500">Signing in with Google...</p>
              ) : (
                <GoogleSignInButton
                  clientId={GOOGLE_CLIENT_ID}
                  text="signup_with"
                  onCredential={handleGoogleCredential}
                  onError={setError}
                />
              )}
              <p className="text-center text-xs text-slate-500">
                A workspace is created automatically. You can connect Instagram after signing in.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Google sign-in is not configured. Add <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> to{' '}
              <code className="font-mono">react-code/.env</code> and restart the frontend.
            </div>
          )}

          <div className="pt-2 text-center text-xs text-slate-500">
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {errorBanner}

          {resetMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resetMessage}</span>
            </div>
          )}

          {mode === 'login' && GOOGLE_CLIENT_ID && !loading && (
            <div className="space-y-3">
              <GoogleSignInButton
                clientId={GOOGLE_CLIENT_ID}
                text="signin_with"
                onCredential={handleGoogleCredential}
                onError={setError}
              />
              <div className="relative text-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  or use email
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-xs text-indigo-600 hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            <Button type="submit" variant="brand" className="w-full mt-2" disabled={loading}>
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In to Workspace'
                : 'Send Reset Instructions'}
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'login' && (
              <p>
                Don't have a workspace?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Create workspace
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
};
