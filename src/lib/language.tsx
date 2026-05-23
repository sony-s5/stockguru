'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { Language } from './langConstants'

export type { Language }
export { LANG_PROMPTS } from './langConstants'

// ✅ Only English
export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'english', label: 'English', native: 'English' },
]

interface LangContextType {
  language: Language
  setLanguage: (l: Language) => void
}

const LangContext = createContext<LangContextType>({
  language: 'english',
  setLanguage: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('english')
  return (
    <LangContext.Provider value={{ language, setLanguage }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LangContext)
}
