import { SafeAreaView } from 'react-native-safe-area-context'
import { WebViewLogin } from '../../src/auth/webview-login'

export default function LoginScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      <WebViewLogin />
    </SafeAreaView>
  )
}
