import { useState, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native'
import type { Allplayer } from '@autogm/shared'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useAdp } from '../../../src/hooks/use-adp'

type PosFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE'

export default function AdpScreen() {
  const { allplayers, loading: apLoading } = useAllPlayers()

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  }, [])

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)
  const [draftType, setDraftType] = useState<string>('')
  const [minDrafts, setMinDrafts] = useState(2)
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL')
  const [search, setSearch] = useState('')

  const { data: adpRows, stats, loading: adpLoading } = useAdp(
    { startDate, endDate, draftType: draftType || null, minDrafts } as any,
    true,
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return adpRows
      .filter((r) => {
        const p = allplayers[r.player_id]
        if (!p) return false
        if (posFilter !== 'ALL' && p.position !== posFilter) return false
        if (q && !(p.full_name || '').toLowerCase().includes(q)) return false
        return true
      })
      .slice(0, 300)
  }, [adpRows, allplayers, posFilter, search])

  const loading = apLoading || adpLoading
  const positions: PosFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']

  return (
    <View className="flex-1 bg-gray-900">
      {/* Filters */}
      <View className="flex-row items-center gap-1.5 px-3 py-2 border-b border-gray-800 flex-wrap">
        <Text className="text-gray-500 text-[10px] font-semibold uppercase">From</Text>
        <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6B7280" className="bg-gray-800 rounded-md px-2 py-1 text-gray-100 text-[11px] border border-gray-700 w-[90px]" />
        <Text className="text-gray-500 text-[10px] font-semibold uppercase">To</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6B7280" className="bg-gray-800 rounded-md px-2 py-1 text-gray-100 text-[11px] border border-gray-700 w-[90px]" />
        <Text className="text-gray-500 text-[10px] font-semibold uppercase">Min</Text>
        <TextInput value={String(minDrafts)} onChangeText={(v) => setMinDrafts(Math.max(1, Number(v) || 1))} keyboardType="number-pad" className="bg-gray-800 rounded-md px-2 py-1 text-gray-100 text-[11px] border border-gray-700 w-9" />
      </View>

      {/* Type + Stats */}
      <View className="flex-row items-center gap-1 px-3 py-1.5 border-b border-gray-800">
        {['', 'snake', 'auction', 'linear'].map((t) => (
          <TouchableOpacity key={t} onPress={() => setDraftType(t)} className={`px-2.5 py-1 rounded-xl ${draftType === t ? 'bg-blue-600' : 'bg-gray-800'}`}>
            <Text className={`text-[11px] font-medium capitalize ${draftType === t ? 'text-white' : 'text-gray-500'}`}>{t || 'Any'}</Text>
          </TouchableOpacity>
        ))}
        {stats && !loading && (
          <Text className="text-gray-500 text-[10px] ml-auto">{stats.n_drafts.toLocaleString()} drafts · {stats.n_leagues.toLocaleString()} leagues</Text>
        )}
      </View>

      {/* Position + Search */}
      <View className="flex-row items-center gap-2 px-3 py-2 border-b border-gray-800">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {positions.map((p) => (
            <TouchableOpacity key={p} onPress={() => setPosFilter(p)} className={`px-3 py-1.5 rounded-[14px] ${posFilter === p ? 'bg-blue-600' : 'bg-gray-800'}`}>
              <Text className={`text-[11px] font-medium ${posFilter === p ? 'text-white' : 'text-gray-500'}`}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          placeholderTextColor="#6B7280"
          className="flex-1 bg-gray-800 rounded-lg px-2.5 py-1.5 text-gray-100 text-xs border border-gray-700"
        />
      </View>

      {/* Results */}
      {loading && filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.player_id}
          ListHeaderComponent={
            <View className="flex-row px-3 py-1.5 border-b border-gray-700">
              <Text className="flex-[2] text-gray-500 text-[10px] font-semibold text-right">Player</Text>
              <Text className="flex-1 text-gray-500 text-[10px] font-semibold text-right">ADP</Text>
              <Text className="flex-1 text-gray-500 text-[10px] font-semibold text-right">Min</Text>
              <Text className="flex-1 text-gray-500 text-[10px] font-semibold text-right">Max</Text>
              <Text className="flex-1 text-gray-500 text-[10px] font-semibold text-right">Stdev</Text>
              <Text className="flex-1 text-gray-500 text-[10px] font-semibold text-right">Auc%</Text>
              <Text className="flex-1 text-gray-500 text-[10px] font-semibold text-right">#</Text>
            </View>
          }
          renderItem={({ item }) => {
            const p = allplayers[item.player_id]
            return (
              <View className="flex-row items-center px-3 py-2 border-b border-gray-800/25">
                <View className="flex-[2]">
                  <Text className="text-gray-100 text-[13px] font-medium" numberOfLines={1}>{p?.full_name || item.player_id}</Text>
                  <Text className="text-gray-500 text-[10px] mt-px">{p?.position ?? '?'} - {p?.team ?? 'FA'}</Text>
                </View>
                <Text className="flex-1 text-gray-100 text-xs text-right">{item.adp.toFixed(1)}</Text>
                <Text className="flex-1 text-gray-100 text-xs text-right">{item.min_pick}</Text>
                <Text className="flex-1 text-gray-100 text-xs text-right">{item.max_pick}</Text>
                <Text className="flex-1 text-gray-100 text-xs text-right">{item.stdev != null ? item.stdev.toFixed(1) : '-'}</Text>
                <Text className="flex-1 text-gray-100 text-xs text-right">{item.avg_pct != null ? `${(item.avg_pct * 100).toFixed(1)}` : '-'}</Text>
                <Text className="flex-1 text-gray-100 text-xs text-right">{item.n_drafts}</Text>
              </View>
            )
          }}
          ListEmptyComponent={<Text className="text-gray-500 text-center p-10 text-[13px]">No results</Text>}
          ListFooterComponent={filtered.length >= 300 ? <Text className="text-gray-500 text-center p-3 text-[11px]">Showing first 300 of {adpRows.length}</Text> : null}
        />
      )}
    </View>
  )
}
