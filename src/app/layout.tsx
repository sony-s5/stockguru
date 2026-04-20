import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StockGuru — 12-Step Investment Analyzer',
  description: 'Fundamental investment analysis tool for Indian stocks',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
