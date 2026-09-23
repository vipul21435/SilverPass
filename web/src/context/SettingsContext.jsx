import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { STRINGS } from './strings.js';

const STORAGE_KEY = 'silverpass.settings';

const DEFAULTS = { language: 'en', textSize: 'normal', contrast: 'normal' };

const SettingsContext = createContext(null);

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    // Private browsing, blocked storage, or corrupt JSON — the defaults are
    // perfectly usable, so never let this break the page.
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStored);

  // Drive the CSS from <html>, so one attribute rescales the whole page.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-text-size', settings.textSize);
    root.setAttribute('data-contrast', settings.contrast);
    root.setAttribute('lang', settings.language);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Not being able to remember the choice is survivable; losing the page is not.
    }
  }, [settings]);

  const update = useCallback((patch) => setSettings((current) => ({ ...current, ...patch })), []);

  /**
   * Looks a string up in the active language, falling back to English so a
   * missing translation degrades to readable text rather than a raw key.
   * `{placeholders}` in the string are replaced from `values`.
   */
  const t = useCallback(
    (key, values) => {
      const template = STRINGS[settings.language]?.[key] ?? STRINGS.en[key] ?? key;
      if (!values) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      );
    },
    [settings.language],
  );

  const value = useMemo(() => ({ ...settings, update, t }), [settings, update, t]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside a SettingsProvider.');
  return context;
}

/** Convenience for the common case of only needing the translator. */
export const useT = () => useSettings().t;
