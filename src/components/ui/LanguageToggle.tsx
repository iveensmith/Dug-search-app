'use client'

import { useLocale } from '@/lib/i18n/LocaleProvider'

/** Switches between English and Pidgin for the scoped set of strings in
 *  src/lib/i18n/dictionary.ts — see that file's header comment for what's
 *  in/out of scope and the "unreviewed AI translation" caveat. */
export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  const isPidgin = locale === 'pcm'

  return (
    <button
      onClick={() => setLocale(isPidgin ? 'en' : 'pcm')}
      title={isPidgin ? 'Switch to English' : 'Switch to Pidgin (machine-translated)'}
      className={`cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 ${className}`}
    >
      {isPidgin ? 'ENG' : 'PCM'}
    </button>
  )
}
