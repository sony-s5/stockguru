// Shared constants — server and client rendu lo use cheyyochu
// No 'use client' directive here!

export type Language = 'telugu' | 'hindi' | 'english' | 'tamil' | 'kannada' | 'malayalam'

export const LANG_PROMPTS: Record<Language, string> = {
  telugu:    'Respond in Telugu-English mix (Tenglish). Use Telugu script mixed with English terms.',
  hindi:     'Respond in Hindi-English mix (Hinglish). Use Hindi script mixed with English terms.',
  english:   'Respond in clear simple English.',
  tamil:     'Respond in Tamil-English mix (Tanglish). Use Tamil script mixed with English terms.',
  kannada:   'Respond in Kannada-English mix. Use Kannada script mixed with English terms.',
  malayalam: 'Respond in Malayalam-English mix. Use Malayalam script mixed with English terms.',
}
