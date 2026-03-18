import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import en, { type Translations } from "./en";
import zh from "./zh";
import ja from "./ja";
import ko from "./ko";
import fr from "./fr";
import de from "./de";
import es from "./es";

type Lang = "en" | "zh" | "ja" | "ko" | "fr" | "de" | "es";

const translations: Record<Lang, Translations> = { en, zh, ja, ko, fr, de, es };

const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

interface I18nContextType {
  t: Translations;
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  t: en,
  lang: "en",
  setLang: () => {},
});

const LANGS = Object.keys(translations) as Lang[];

function detectLang(): Lang {
  const saved = localStorage.getItem("lang");
  if (saved && saved in translations) return saved as Lang;
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  }, []);

  return (
    <I18nContext.Provider value={{ t: translations[lang], lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { LANGS, LANG_LABELS };
export type { Lang };
