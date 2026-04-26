import { useCallback, useEffect, useState } from 'react'
import { Text, View, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native'
import { Tabs, Redirect, useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { clearSession } from '@autogm/shared'
import { useAuth } from '@autogm/shared/react'
import { LeagueCacheProvider } from '../../src/league-cache'
import { checkAccess } from '../../src/access'
import { colors } from '../../src/theme'

export default function AppLayout() {
  const { session, restoring, clearSession: clearAuthSession } = useAuth()
  const router = useRouter()
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null)

  // Check allowlist after session is available
  useEffect(() => {
    if (restoring || !session?.user_id) return
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

  // Wait for access check
  if (accessAllowed === null) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blueLight} />
        <Text style={s.text}>Checking access...</Text>
      </View>
    )
  }

  if (!accessAllowed) {
    return (
      <View style={s.center}>
        <Text style={s.title}>Access Denied</Text>
        <Text style={s.text}>
          Your account ({session.user_id}) is not on the access list.
        </Text>
        <TouchableOpacity onPress={handleLogout} style={s.btn}>
          <Text style={s.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const logoutButton = () => (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Sign Out</Text>
    </TouchableOpacity>
  )

  return (
    <LeagueCacheProvider>
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
    </LeagueCacheProvider>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: colors.white, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  text: { color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  btn: { backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  btnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
})
