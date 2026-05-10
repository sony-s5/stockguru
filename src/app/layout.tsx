import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/language'

export const metadata: Metadata = {
  title: 'StockGuru — 12-Step Investment Analyzer',
  description: 'Fundamental investment analysis tool for Indian stocks',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
