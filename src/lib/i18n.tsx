import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AR } from "./i18n-dict";

export type Lang = "en" | "ar";

const STORAGE_KEY = "revertv_lang";

type Ctx = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<Ctx | null>(null);

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Convert western digits to Arabic-Indic digits for a more native feel. */
export function localizeDigits(s: string, lang: Lang) {
  if (lang !== "ar") return s;
  return s;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "ar" || saved === "en") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      if (lang === "en") return interpolate(key, vars);
      return interpolate(AR[key] ?? key, vars);
    },
    [lang],
  );

  const value = useMemo<Ctx>(
    () => ({ lang, dir, setLang, toggle: () => setLang(lang === "en" ? "ar" : "en"), t }),
    [lang, dir, setLang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Safe fallback so components never crash outside the provider.
    return {
      lang: "en",
      dir: "ltr",
      setLang: () => {},
      toggle: () => {},
      t: (k, v) => interpolate(k, v),
    };
  }
  return ctx;
}

/** Shorthand: const t = useT() */
export function useT() {
  return useI18n().t;
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={`vacation-allow inline-flex items-center rounded-full border border-border/60 bg-secondary/50 p-0.5 text-[11px] font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`px-2.5 py-1 rounded-full transition ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("ar")}
        aria-pressed={lang === "ar"}
        className={`px-2.5 py-1 rounded-full transition ${lang === "ar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
      >
        عربي
      </button>
    </div>
  );
}
