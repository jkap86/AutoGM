import { Component, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../theme'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <View style={s.container}>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>{this.state.error.message}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={s.btn}
          >
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { color: colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  btn: { backgroundColor: colors.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
})
