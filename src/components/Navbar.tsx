'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar({ user }: { user: any }) {
  const router = useRouter()
  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }
  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <Link href="/dashboard" className="text-green-700 font-bold text-lg">📈 StockGuru</Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/analyze" className="text-gray-600 hover:text-gray-900">Analyze</Link>
        <Link href="/stocks" className="text-gray-600 hover:text-gray-900">Stocks</Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Portfolio</Link>
        {user && (
          <button onClick={logout} className="text-gray-400 hover:text-red-500 text-xs">Logout</button>
        )}
      </div>
    </nav>
  )
}
