import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native'
import type { Allplayer } from '@autogm/shared'

export function PlayerCombobox({
  playerIds,
  allplayers,
  selected,
  onSelect,
  placeholder = 'Search player...',
}: {
  playerIds: string[]
  allplayers: Record<string, Allplayer>
  selected: string[]
  onSelect: (id: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return playerIds
      .filter((id) => {
        const p = allplayers[id]
        if (!p) return false
        return (p.full_name || '').toLowerCase().includes(q)
      })
      .slice(0, 30)
  }, [query, playerIds, allplayers])

  return (
    <View className="relative">
      <TextInput
        value={query}
        onChangeText={(v) => { setQuery(v); setOpen(true) }}
        onFocus={() => { if (query.trim()) setOpen(true) }}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-gray-100 text-sm"
      />
      {open && filtered.length > 0 && (
        <View className="absolute top-10 left-0 right-0 z-50 max-h-48 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden"
          style={{ elevation: 10 }}>
          <FlatList
            data={filtered}
            keyExtractor={(id) => id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: id }) => {
              const p = allplayers[id]
              const isSelected = selected.includes(id)
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (!isSelected) {
                      onSelect(id)
                      setQuery('')
                      setOpen(false)
                    }
                  }}
                  className={`flex-row items-center px-2.5 py-2 border-b border-gray-700/50 ${isSelected ? 'opacity-40' : ''}`}
                >
                  <Text className="text-gray-500 text-[10px] font-semibold w-7">{p?.position ?? '?'}</Text>
                  <Text className="flex-1 text-gray-100 text-xs" numberOfLines={1}>{p?.full_name || id}</Text>
                  <Text className="text-gray-500 text-[10px]">{p?.team ?? 'FA'}</Text>
                </TouchableOpacity>
              )
            }}
          />
        </View>
      )}
    </View>
  )
}
