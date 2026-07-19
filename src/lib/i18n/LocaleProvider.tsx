'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dictionary, type Locale, type DictKey } from './dictionary'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: DictKey) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function isLocale(v: string | null): v is Locale {
  return v === 'en' || v === 'pcm'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    // Reads a client-only preference (localStorage) — briefly shows English
    // on first paint before this runs, same tradeoff as ThemeToggle's [data-theme]
    // sync (no CSS-only equivalent exists for translated text content).
    const stored = localStorage.getItem('locale')
    if (isLocale(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored)
    }
  }, [])

  function setLocale(next: Locale) {
    setLocaleState(next)
    localStorage.setItem('locale', next)
  }

  function t(key: DictKey): string {
    return dictionary[locale][key] ?? dictionary.en[key]
  }

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
