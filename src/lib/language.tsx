'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { Language } from './langConstants'

export type { Language }
export { LANG_PROMPTS } from './langConstants'

export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'telugu',    label: 'Telugu',    native: 'తెలుగు' },
  { code: 'hindi',     label: 'Hindi',     native: 'हिंदी' },
  { code: 'english',   label: 'English',   native: 'English' },
  { code: 'tamil',     label: 'Tamil',     native: 'தமிழ்' },
  { code: 'kannada',   label: 'Kannada',   native: 'ಕನ್ನಡ' },
  { code: 'malayalam', label: 'Malayalam', native: 'മലയാളം' },
]

interface LangContextType {
  language: Language
  setLanguage: (l: Language) => void
}

const LangContext = createContext<LangContextType>({
  language: 'telugu',
  setLanguage: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('telugu')
  return (
    <LangContext.Provider value={{ language, setLanguage }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LangContext)
}
