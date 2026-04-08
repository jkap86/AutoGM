'use client'

import { useState } from 'react'

type LoginResult = {
  token: string | null
  user_id: string | null
}

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LoginResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await window.ipc.invoke<LoginResult>('login')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Sleepier</h1>
      <p className="text-gray-400">Next.js App Router + Electron + Tailwind</p>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Waiting for sign-in…' : 'Sign in with Sleeper'}
      </button>

      {result && (
        <pre className="max-w-xl whitespace-pre-wrap break-all rounded bg-gray-900 p-4 text-xs text-gray-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {error && (
        <p className="max-w-xl text-sm text-red-400">{error}</p>
      )}
    </main>
  )
}
