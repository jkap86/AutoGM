import 'react-native-get-random-values'
import { useEffect } from 'react'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SecureStore from 'expo-secure-store'
import { setSession } from '@autogm/shared'
import { AuthProvider, useAuth } from '@autogm/shared/react'

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
    <AuthProvider>
      <HydrateSession />
      <StatusBar style="light" />
      <Slot />
    </AuthProvider>
  )
}
