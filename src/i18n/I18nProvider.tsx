import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { getMessages, localeStorageKey, type Locale, type MessageKey } from "./messages";

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

function readStoredLocale(): Locale {
  const stored = window.localStorage.getItem(localeStorageKey);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  const lang = navigator.language?.toLowerCase() ?? "";
  return lang.startsWith("zh") ? "zh" : "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(localeStorageKey, next);
  }, []);

  const table = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => interpolate(table[key], vars),
    [table]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : "en";
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return ctx;
}
