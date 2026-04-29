import { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import TradesScreen from '../trades/index'
import DmsScreen from '../dms/index'

type SubTab = 'trades' | 'waivers' | 'dms'

export default function TransactionsTab() {
  const [subTab, setSubTab] = useState<SubTab>('trades')

  return (
    <View className="flex-1 bg-gray-900">
      {/* Sub-tab bar */}
      <View className="flex-row border-b border-gray-800 px-4">
        {(['trades', 'waivers', 'dms'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setSubTab(tab)}
            className={`py-3 px-4 ${subTab === tab ? 'border-b-2 border-blue-400' : ''}`}
          >
            <Text
              className={`text-sm font-semibold capitalize ${
                subTab === tab ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {subTab === 'trades' && <TradesScreen />}
      {subTab === 'waivers' && (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-gray-500 text-sm">Waivers coming soon</Text>
        </View>
      )}
      {subTab === 'dms' && <DmsScreen />}
    </View>
  )
}
