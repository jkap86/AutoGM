import { useRef, useCallback, useState } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { WebView, WebViewMessageEvent } from 'react-native-webview'
import * as SecureStore from 'expo-secure-store'
import { setSession } from '@sleepier/shared'
import { useAuth } from '@sleepier/shared/react'
import { colors } from '../theme'

const SLEEPER_LOGIN_URL = 'https://sleeper.com/login'
const AUTH_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// Injected JS that polls localStorage for the auth token after login.
// Gives up after AUTH_TIMEOUT_MS to avoid hanging forever.
const INJECT_JS = `
  (function poll(start) {
    var elapsed = Date.now() - start;
    if (elapsed > ${AUTH_TIMEOUT_MS}) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'timeout' }));
      return;
    }
    var token = localStorage.getItem('token');
    var user_id = localStorage.getItem('user_id');
    if (token && user_id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ token: token, user_id: user_id }));
    } else {
      setTimeout(function() { poll(start); }, 500);
    }
  })(Date.now());
  true;
`

export function WebViewLogin() {
  const webViewRef = useRef<WebView>(null)
  const { setSession: setAuthSession } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data)

        if (data.error === 'timeout') {
          setTimedOut(true)
          return
        }

        const { token, user_id } = data
        if (token && user_id) {
          await SecureStore.setItemAsync('sleeper_token', token)
          await SecureStore.setItemAsync('sleeper_user_id', user_id)
          setSession({ token, user_id })
          setAuthSession({ token, user_id })
        }
      } catch {
        // Ignore malformed messages from the WebView
      }
    },
    [setAuthSession],
  )

  const retry = useCallback(() => {
    setTimedOut(false)
    webViewRef.current?.reload()
  }, [])

  if (timedOut) {
    return (
      <View style={s.center}>
        <Text style={s.title}>Login timed out</Text>
        <Text style={s.body}>
          Could not detect your Sleeper session. Please try again.
        </Text>
        <TouchableOpacity onPress={retry} style={s.btn}>
          <Text style={s.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

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
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.blueLight} />
            <Text style={[s.body, { marginTop: 12 }]}>Loading Sleeper...</Text>
          </View>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: colors.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  btnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
})
