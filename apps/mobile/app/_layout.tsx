import 'react-native-get-random-values'
import '../global.css'
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SecureStore from 'expo-secure-store'
import { useFonts } from 'expo-font'
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { Rajdhani_400Regular, Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani'
import { setSession } from '@autogm/shared'
import { AuthProvider, useAuth } from '@autogm/shared/react'
import { SocketProvider } from '../src/contexts/socket-context'

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
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_700Bold,
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  })

  if (!fontsLoaded) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#60A5FA" />
      </View>
    )
  }

  return (
    <AuthProvider>
      <SocketProvider>
        <HydrateSession />
        <StatusBar style="light" />
        <Slot />
      </SocketProvider>
    </AuthProvider>
  )
}
