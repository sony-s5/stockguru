'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

export type Language = 'telugu' | 'hindi' | 'english' | 'tamil' | 'kannada' | 'malayalam'

export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'telugu',    label: 'Telugu',    native: 'తెలుగు' },
  { code: 'hindi',     label: 'Hindi',     native: 'हिंदी' },
  { code: 'english',   label: 'English',   native: 'English' },
  { code: 'tamil',     label: 'Tamil',     native: 'தமிழ்' },
  { code: 'kannada',   label: 'Kannada',   native: 'ಕನ್ನಡ' },
  { code: 'malayalam', label: 'Malayalam', native: 'മലയാളം' },
]

export const LANG_PROMPTS: Record<Language, string> = {
  telugu:    'Respond in Telugu-English mix (Tenglish). Use Telugu script mixed with English terms.',
  hindi:     'Respond in Hindi-English mix (Hinglish). Use Hindi script mixed with English terms.',
  english:   'Respond in clear simple English.',
  tamil:     'Respond in Tamil-English mix (Tanglish). Use Tamil script mixed with English terms.',
  kannada:   'Respond in Kannada-English mix. Use Kannada script mixed with English terms.',
  malayalam: 'Respond in Malayalam-English mix. Use Malayalam script mixed with English terms.',
}

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
