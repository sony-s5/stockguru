'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage, LANGUAGES } from '@/lib/language'

export default function Navbar({ user }: { user: any }) {
  const router = useRouter()
  const { language, setLanguage } = useLanguage()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="border-b bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <Link href="/" className="text-green-700 font-bold text-lg">📈 StockGuru</Link>

      <div className="flex items-center gap-3 text-sm">
        <Link href="/analyze" className="text-gray-600 hover:text-gray-900 hidden sm:block">Analyze</Link>
        <Link href="/stocks"  className="text-gray-600 hover:text-gray-900 hidden sm:block">Stocks</Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 hidden sm:block">Portfolio</Link>

        {/* Language Selector */}
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as any)}
          className="border rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>

        {user ? (
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500">Logout</button>
        ) : (
          <Link href="/auth" className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}
