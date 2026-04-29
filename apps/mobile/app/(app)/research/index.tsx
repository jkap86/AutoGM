import { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import PollsScreen from '../polls/index'
import AdpScreen from '../adp/index'

type SubTab = 'polls' | 'adp'

export default function ResearchTab() {
  const [subTab, setSubTab] = useState<SubTab>('polls')

  return (
    <View className="flex-1 bg-gray-900">
      {/* Sub-tab bar */}
      <View className="flex-row border-b border-gray-800 px-4">
        {(['polls', 'adp'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setSubTab(tab)}
            className={`py-3 px-4 ${subTab === tab ? 'border-b-2 border-blue-400' : ''}`}
          >
            <Text
              className={`text-sm font-semibold uppercase ${
                subTab === tab ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {subTab === 'polls' && <PollsScreen />}
      {subTab === 'adp' && <AdpScreen />}
    </View>
  )
}
