import { useEffect, useRef, useState } from 'react';

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  cancel_on_tap_outside?: boolean;
};

type GoogleButtonOptions = {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
};

type GoogleIdentityApi = {
  initialize: (options: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
  }
}

const SCRIPT_ID = 'google-identity-services';
let scriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google sign-in could not be loaded'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface GoogleSignInButtonProps {
  clientId?: string;
  text?: GoogleButtonOptions['text'];
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({ clientId, text = 'continue_with', onCredential, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const credentialHandler = useRef(onCredential);
  const errorHandler = useRef(onError);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  credentialHandler.current = onCredential;
  errorHandler.current = onError;

  useEffect(() => {
    let active = true;
    loadGoogleIdentityScript()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setLoadError('Google sign-in could not be loaded. Check your connection and try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !clientId) return;
    const container = containerRef.current;
    const googleId = window.google?.accounts?.id;
    if (!container || !googleId) return;

    googleId.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (response.credential) credentialHandler.current(response.credential);
        else errorHandler.current('Google did not return a sign-in credential.');
      },
    });
    container.replaceChildren();
    googleId.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text,
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320,
    });
  }, [ready, clientId, text]);

  if (!clientId) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex min-h-10 justify-center" />
      {loadError && <p className="text-center text-xs text-rose-600">{loadError}</p>}
    </div>
  );
}
