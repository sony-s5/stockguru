// Navbar.tsx — complete corrected file
'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage, LANGUAGES } from '@/lib/language'

export default function Navbar({ user }: { user: any }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { language, setLanguage } = useLanguage()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navLinks = [
    { href: '/analyze',   label: 'Analyze',   icon: '🔍' },
    { href: '/stocks',    label: 'Stocks',     icon: '📊' },
    { href: '/dashboard', label: 'Portfolio',  icon: '💼' },
  ]

  return (
    <>
      {/* Top Navbar */}
      <nav className="border-b bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="text-green-700 font-bold text-lg">📈 StockGuru</Link>

        <div className="flex items-center gap-3 text-sm">
          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4">
            {navLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${pathname === l.href ? 'text-green-700 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Language Selector */}
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as any)}
            className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>

          {/* Desktop logout */}
          {user ? (
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-red-500 hidden md:block"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/auth"
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
            >
              Login
            </Link>
          )}
        </div>
      </nav>

      {/* Bottom Navigation — Mobile only */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 md:hidden">
        <div className="flex items-center justify-around py-2 pb-safe">
          {navLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                pathname === l.href ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              <span className="text-xl leading-none">{l.icon}</span>
              <span className="text-xs font-medium">{l.label}</span>
            </Link>
          ))}

          {/* ✅ Fix: user logged in ఉంటే Logout, లేకపోతే Login */}
          {user ? (
            <button
              onClick={logout}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <span className="text-xl leading-none">🚪</span>
              <span className="text-xs font-medium">Logout</span>
            </button>
          ) : (
            <Link
              href="/auth"
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-green-600"
            >
              <span className="text-xl leading-none">🔑</span>
              <span className="text-xs font-medium">Login</span>
            </Link>
          )}
        </div>
      </div>

      {/* ✅ Fix: h-20 so content clears bottom nav properly */}
      <div className="h-20 md:hidden" />
    </>
  )
}
