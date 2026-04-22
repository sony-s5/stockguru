'use client'
import { Suspense, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function AuthForm() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="bg-white border rounded-2xl p-8 w-full max-w-sm shadow-sm text-center">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Check Your Email!</h2>
        <p className="text-sm text-gray-500 mb-1">
          <span className="font-medium text-gray-800">{email}</span> ki magic link pampaamu!
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Email lo link click cheyyi — automatic ga login avutundi. Password ledu!
        </p>
        <button
          onClick={() => { setSent(false); setEmail('') }}
          className="text-sm text-green-600 hover:underline"
        >
          Vere email try cheyyi
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-2xl p-8 w-full max-w-sm shadow-sm">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-6">
        <span className="text-2xl">📈</span>
        <span className="text-green-700 font-bold text-xl">StockGuru</span>
      </Link>

      <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome!</h2>
      <p className="text-sm text-gray-400 mb-6">
        Email enter cheyyi — magic link vasthundi. Password ledu!
      </p>

      <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Email Address</label>
          <input
            type="email"
            placeholder="mee@gmail.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-60 text-sm"
        >
          {loading ? 'Sending...' : '✉️ Magic Link Pampu'}
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-6">
        Email lo link click chesthe login avutundi — no password needed!
      </p>
    </div>
  )
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="bg-white border rounded-2xl p-8 w-full max-w-sm text-center text-gray-400">
          Loading...
        </div>
      }>
        <AuthForm />
      </Suspense>
    </div>
  )
}
