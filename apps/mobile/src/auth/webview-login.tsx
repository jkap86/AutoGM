import { useRef, useCallback } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { WebView, WebViewMessageEvent } from 'react-native-webview'
import * as SecureStore from 'expo-secure-store'
import { setSession } from '@sleepier/shared'
import { useAuth } from '@sleepier/shared'

const SLEEPER_LOGIN_URL = 'https://sleeper.com/login'

// Injected JS that polls localStorage for the auth token after login
const INJECT_JS = `
  (function poll() {
    const token = localStorage.getItem('token');
    const user_id = localStorage.getItem('user_id');
    if (token && user_id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ token, user_id }));
    } else {
      setTimeout(poll, 500);
    }
  })();
  true;
`

export function WebViewLogin() {
  const webViewRef = useRef<WebView>(null)
  const { setSession: setAuthSession } = useAuth()

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const { token, user_id } = JSON.parse(event.nativeEvent.data)
        if (token && user_id) {
          // Persist to secure storage
          await SecureStore.setItemAsync('sleeper_token', token)
          await SecureStore.setItemAsync('sleeper_user_id', user_id)

          // Set in shared session (for GraphQL client)
          setSession({ token, user_id })

          // Update React auth context
          setAuthSession({ token, user_id })
        }
      } catch {
        // Ignore malformed messages
      }
    },
    [setAuthSession],
  )

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ uri: SLEEPER_LOGIN_URL }}
        injectedJavaScript={INJECT_JS}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 12, color: '#9CA3AF' /* gray-400 */ }}>Loading Sleeper...</Text>
          </View>
        )}
      />
    </View>
  )
}
