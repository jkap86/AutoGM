'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSleeperLogin } from '../../hooks/use-sleeper-login'

export default function HomePage() {
  const router = useRouter()
  const { login, loading, result, error } = useSleeperLogin()

  useEffect(() => {
    if (result?.token && result?.user_id) {
      router.push('/dashboard')
    }
  }, [result?.token, result?.user_id, router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Sleepier</h1>
      <p className="text-gray-400">Next.js App Router + Electron + Tailwind</p>

      <button
        onClick={login}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Waiting for sign-in…' : 'Sign in with Sleeper'}
      </button>

      {error && <p className="max-w-xl text-sm text-red-400">{error}</p>}
    </main>
  )
}
