import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebViewLogin } from '../../src/auth/webview-login'
import { useAuth } from '@autogm/shared/react'
import { setSession } from '@autogm/shared'
import { DEMO_SESSION } from '../../src/demo-data'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const { setSession: setAuthSession } = useAuth()

  const enterDemo = () => {
    setSession(DEMO_SESSION)
    setAuthSession(DEMO_SESSION)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      <WebViewLogin />
      <View style={s.demoBar}>
        <TouchableOpacity onPress={enterDemo} style={s.demoBtn}>
          <Text style={s.demoText}>Try Demo Mode</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  demoBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  demoBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  demoText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
})
