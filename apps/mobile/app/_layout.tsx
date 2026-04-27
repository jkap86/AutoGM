import { View, Text } from 'react-native'

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>AutoGM</Text>
      <Text style={{ color: '#888', fontSize: 14, marginTop: 8 }}>App loaded successfully</Text>
    </View>
  )
}
