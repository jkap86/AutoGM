import { useCallback, useEffect, useState } from 'react'
import { Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { Tabs, Redirect, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { clearSession } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { LeagueCacheProvider } from '../../src/league-cache'
import { checkAccess } from '../../src/access'
import { DEMO_SESSION } from '../../src/demo-data'

export default function AppLayout() {
  const { session, restoring, clearSession: clearAuthSession } = useAuth()
  const router = useRouter()
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (restoring || !session?.user_id) return
    if (session.user_id === DEMO_SESSION.user_id) {
      setAccessAllowed(true)
      return
    }
    checkAccess(session.user_id).then(setAccessAllowed)
  }, [restoring, session?.user_id])

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
          setAccessAllowed(null)
          router.replace('/(auth)/login')
        },
      },
    ])
  }, [clearAuthSession, router])

  if (restoring) return null

  if (!session?.user_id) {
    return <Redirect href="/(auth)/login" />
  }

  if (accessAllowed === null) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text className="text-gray-400 text-center mt-2">Checking access...</Text>
      </View>
    )
  }

  if (!accessAllowed) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center p-6">
        <Text className="text-white text-xl font-bold mb-2">Access Denied</Text>
        <Text className="text-gray-400 text-center mt-2">
          Your account ({session.user_id}) is not on the access list.
        </Text>
        <TouchableOpacity onPress={handleLogout} className="bg-gray-800 px-5 py-2.5 rounded-lg mt-4">
          <Text className="text-gray-400 font-semibold text-sm">Sign Out</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const logoutButton = () => (
    <TouchableOpacity onPress={handleLogout} className="mr-2">
      <Text className="text-gray-500 text-xs">Sign Out</Text>
    </TouchableOpacity>
  )

  return (
    <LeagueCacheProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#F3F4F6',
          tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1F2937' },
          tabBarActiveTintColor: '#60A5FA',
          tabBarInactiveTintColor: '#6B7280',
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
          name="transactions/index"
          options={{
            title: 'Transactions',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔄</Text>,
          }}
        />
        <Tabs.Screen
          name="research/index"
          options={{
            title: 'Research',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
          }}
        />
        {/* Hidden routes - accessed within tab views */}
        <Tabs.Screen name="rankings/index" options={{ href: null }} />
        <Tabs.Screen name="chats/index" options={{ href: null }} />
        <Tabs.Screen name="trades/index" options={{ href: null }} />
        <Tabs.Screen name="trades/create" options={{ href: null }} />
        <Tabs.Screen name="adp/index" options={{ href: null }} />
        <Tabs.Screen name="polls/index" options={{ href: null }} />
      </Tabs>
    </LeagueCacheProvider>
  )
}
