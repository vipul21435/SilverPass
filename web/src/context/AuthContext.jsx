import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, tokenStore } from '../lib/api.js';
import { useSettings } from './SettingsContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(tokenStore.get() ? 'loading' : 'signed-out');
  const { update: updateSettings } = useSettings();

  /** Adopt the accessibility choices saved on the account. */
  const adoptPreferences = useCallback(
    (account) => {
      if (!account?.preferences) return;
      updateSettings({
        language: account.preferences.language,
        textSize: account.preferences.largeText ? 'large' : 'normal',
        contrast: account.preferences.highContrast ? 'high' : 'normal',
      });
    },
    [updateSettings],
  );

  // Restore the session on a reload. A stored token that the server rejects is
  // dropped straight away rather than left to fail on the next action.
  useEffect(() => {
    if (!tokenStore.get()) return undefined;

    const controller = new AbortController();
    api
      .me(controller.signal)
      .then(({ user: account }) => {
        setUser(account);
        adoptPreferences(account);
        setStatus('signed-in');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        tokenStore.set(null);
        setUser(null);
        setStatus('signed-out');
      });

    return () => controller.abort();
    // adoptPreferences is stable for the life of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = useCallback(
    ({ user: account, token }) => {
      tokenStore.set(token);
      setUser(account);
      adoptPreferences(account);
      setStatus('signed-in');
      return account;
    },
    [adoptPreferences],
  );

  const value = useMemo(
    () => ({
      user,
      status,
      isSignedIn: status === 'signed-in',
      isLoading: status === 'loading',
      register: async (body) => accept(await api.register(body)),
      signIn: async (body) => accept(await api.login(body)),
      signOut: () => {
        tokenStore.set(null);
        setUser(null);
        setStatus('signed-out');
      },
      refresh: async () => {
        const { user: account } = await api.me();
        setUser(account);
        return account;
      },
    }),
    [user, status, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
