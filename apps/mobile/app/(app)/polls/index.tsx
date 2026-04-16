import { View, Text, StyleSheet } from 'react-native'

export default function PollsScreen() {
  return (
    <View style={s.center}>
      <Text style={s.title}>Polls</Text>
      <Text style={s.body}>
        Poll creation and viewing coming soon. This feature requires the poll
        storage layer to be adapted for mobile (AsyncStorage).
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  body: { color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
})
