import type { Metadata } from 'next'
import { Space_Grotesk, Rajdhani } from 'next/font/google'
import '../styles/globals.css'
import { AuthProvider } from '../contexts/auth-context'
import { SocketProvider } from '../contexts/socket-context'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AutoGM',
  description: 'AutoGM desktop app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${rajdhani.variable}`}>
      <body>
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
