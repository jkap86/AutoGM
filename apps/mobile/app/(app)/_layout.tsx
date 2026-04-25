import { Tabs, Redirect } from 'expo-router'
import { Text } from 'react-native'
import { useAuth } from '@sleepier/shared'

export default function AppLayout() {
  const { session } = useAuth()

  if (!session?.user_id) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#F3F4F6',
        tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1F2937' },
        tabBarActiveTintColor: '#60A5FA',
        tabBarInactiveTintColor: '#6B7280',
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
