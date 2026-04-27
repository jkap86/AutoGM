import 'react-native-get-random-values'
import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SecureStore from 'expo-secure-store'
import { setSession } from '@autogm/shared'
import { AuthProvider, useAuth } from '@autogm/shared/react'
import { ErrorBoundary } from '../src/error-boundary'

function HydrateSession() {
  const { setSession: setAuthSession, setRestoring } = useAuth()

  useEffect(() => {
    async function restore() {
      try {
        const token = await SecureStore.getItemAsync('sleeper_token')
        const user_id = await SecureStore.getItemAsync('sleeper_user_id')
        if (token && user_id) {
          setSession({ token, user_id })
          setAuthSession({ token, user_id })
        }
      } finally {
        setRestoring(false)
      }
    }
    restore()
  }, [setAuthSession, setRestoring])

  return null
}

export default function RootLayout() {
  return (
    <CrashCatcher>
      <AuthProvider>
        <HydrateSession />
        <StatusBar style="light" />
        <Slot />
      </AuthProvider>
    </CrashCatcher>
  )
}

function CrashCatcher({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null)

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111', padding: 40, paddingTop: 80 }}>
        <Text style={{ color: '#f55', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
          App Crashed
        </Text>
        <ScrollView>
          <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>
            {error.message}
          </Text>
          <Text style={{ color: '#888', fontSize: 10, fontFamily: 'monospace', marginTop: 8 }}>
            {error.stack}
          </Text>
        </ScrollView>
      </View>
    )
  }

  return <ErrorBoundary onError={setError}>{children}</ErrorBoundary>
}
