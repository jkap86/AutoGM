import { useCallback } from 'react'
import { Text, TouchableOpacity, Alert } from 'react-native'
import { Tabs, Redirect, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useAuth, clearSession } from '@sleepier/shared'
import { colors } from '../../src/theme'

export default function AppLayout() {
  const { session, restoring, clearSession: clearAuthSession } = useAuth()
  const router = useRouter()

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('sleeper_token')
          await SecureStore.deleteItemAsync('sleeper_user_id')
          clearSession()
          clearAuthSession()
          router.replace('/(auth)/login')
        },
      },
    ])
  }, [clearAuthSession, router])

  if (restoring) return null

  if (!session?.user_id) {
    return <Redirect href="/(auth)/login" />
  }

  const logoutButton = () => (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sign Out</Text>
    </TouchableOpacity>
  )

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.card },
        tabBarActiveTintColor: colors.blueLight,
        tabBarInactiveTintColor: colors.textMuted,
        headerRight: logoutButton,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏈</Text>,
        }}
      />
      <Tabs.Screen
        name="trades/index"
        options={{
          title: 'Trades',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔄</Text>,
        }}
      />
      <Tabs.Screen
        name="polls/index"
        options={{
          title: 'Polls',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
        }}
      />
    </Tabs>
  )
}
