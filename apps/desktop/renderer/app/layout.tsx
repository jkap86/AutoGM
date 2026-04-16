import type { Metadata } from 'next'
import '../styles/globals.css'
import { AuthProvider } from '../contexts/auth-context'

export const metadata: Metadata = {
  title: 'Sleepier',
  description: 'Sleepier desktop app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
