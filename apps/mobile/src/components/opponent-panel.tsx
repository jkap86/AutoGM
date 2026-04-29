import { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, FlatList } from 'react-native'
import type { Allplayer, LeagueDetailed, Roster } from '@autogm/shared'
import { getPickId } from '@autogm/shared'

const POS_COLORS: Record<string, string> = {
  QB: '#EF4444',
  RB: '#22C55E',
  WR: '#3B82F6',
  TE: '#F97316',
}

const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 }

type Tab = 'shares' | 'roster'

type PlayerShare = {
  playerId: string
  count: number
  position: string
  name: string
}

export function OpponentPanel({
  partner,
  league,
  allplayers,
  leagues,
  visible,
  onClose,
}: {
  partner: Roster
  league: LeagueDetailed
  allplayers: { [id: string]: Allplayer }
  leagues: { [league_id: string]: LeagueDetailed }
  visible: boolean
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('shares')

  const playerShares = useMemo<PlayerShare[]>(() => {
    const counts: Record<string, number> = {}
    for (const lg of Object.values(leagues)) {
      const roster = lg.rosters.find((r) => r.user_id === partner.user_id)
      if (!roster) continue
      for (const pid of roster.players) {
        counts[pid] = (counts[pid] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .map(([playerId, count]) => {
        const p = allplayers[playerId]
        return {
          playerId,
          count,
          position: p?.position ?? '?',
          name: p?.full_name ?? playerId,
        }
      })
      .sort((a, b) => b.count - a.count || (POS_ORDER[a.position] ?? 99) - (POS_ORDER[b.position] ?? 99))
  }, [partner.user_id, leagues, allplayers])

  const maxShareCount = playerShares[0]?.count ?? 1

  // --- roster grouping ---
  const starterSlots = league.roster_positions.filter(
    (s) => s !== 'BN' && s !== 'IR' && s !== 'TAXI',
  )
  const starters = partner.starters.filter((id) => id !== '0')
  const taxi = partner.taxi ?? []
  const reserve = partner.reserve ?? []
  const bench = partner.players.filter(
    (id) => !starters.includes(id) && !taxi.includes(id) && !reserve.includes(id),
  )

  const sortBench = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const posA = POS_ORDER[allplayers[a]?.position ?? '?'] ?? 99
      const posB = POS_ORDER[allplayers[b]?.position ?? '?'] ?? 99
      return posA - posB
    })

  const sortedBench = sortBench(bench)

  const sortedPicks = [...partner.draftpicks].sort((a, b) => {
    if (a.season !== b.season) return a.season.localeCompare(b.season)
    if (a.round !== b.round) return a.round - b.round
    return (a.order ?? 99) - (b.order ?? 99)
  })

  const renderPlayer = (id: string, slotLabel?: string) => {
    const p = allplayers[id]
    const name = p?.full_name || id
    const pos = slotLabel ?? p?.position ?? '?'
    const team = p?.team || ''
    const color = POS_COLORS[pos] ?? '#6B7280'

    return (
      <View key={id} className="flex-row items-center gap-1.5 px-2 py-1">
        <View className="w-8 items-center rounded" style={{ backgroundColor: color + '22' }}>
          <Text style={{ color }} className="text-[10px] font-bold">
            {pos}
          </Text>
        </View>
        <Text className="flex-1 text-xs text-gray-300" numberOfLines={1}>
          {name}
        </Text>
        {team ? <Text className="text-[10px] text-gray-600">{team}</Text> : null}
      </View>
    )
  }

  const renderGroupLabel = (label: string) => (
    <Text className="text-[10px] text-gray-600 uppercase tracking-wider mt-2 mb-0.5 px-2">
      {label}
    </Text>
  )

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-gray-900 rounded-t-2xl max-h-[85%] border-t border-gray-700">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-700">
            <View className="flex-1 mr-3">
              <Text className="text-white font-semibold text-base" numberOfLines={1}>
                {partner.username}
              </Text>
              <Text className="text-gray-500 text-xs" numberOfLines={1}>
                {league.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="px-3 py-1">
              <Text className="text-blue-400 text-sm font-medium">Close</Text>
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View className="flex-row border-b border-gray-700">
            {(['shares', 'roster'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                className={`flex-1 py-2.5 items-center ${tab === t ? 'border-b-2 border-blue-400' : ''}`}
              >
                <Text
                  className={`text-sm font-medium ${tab === t ? 'text-blue-400' : 'text-gray-500'}`}
                >
                  {t === 'shares' ? 'Player Shares' : 'Roster'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {tab === 'shares' ? (
            <FlatList
              data={playerShares}
              keyExtractor={(item) => item.playerId}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
              renderItem={({ item }) => {
                const color = POS_COLORS[item.position] ?? '#6B7280'
                const barWidth = `${Math.round((item.count / maxShareCount) * 100)}%`
                return (
                  <View className="flex-row items-center gap-2 py-1.5">
                    <View
                      className="w-8 items-center rounded"
                      style={{ backgroundColor: color + '22' }}
                    >
                      <Text style={{ color }} className="text-[10px] font-bold">
                        {item.position}
                      </Text>
                    </View>
                    <Text className="w-28 text-xs text-gray-300" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{ width: barWidth, backgroundColor: color }}
                      />
                    </View>
                    <Text className="w-6 text-right text-xs text-gray-400">{item.count}</Text>
                  </View>
                )
              }}
              ListEmptyComponent={
                <Text className="text-gray-500 text-sm text-center py-8">No shared leagues</Text>
              }
            />
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              {starters.length > 0 && (
                <View>
                  {renderGroupLabel('Starters')}
                  {starters.map((id, i) => {
                    const slot = starterSlots[partner.starters.indexOf(id)]
                    return renderPlayer(id, slot)
                  })}
                </View>
              )}

              {sortedBench.length > 0 && (
                <View>
                  {renderGroupLabel('Bench')}
                  {sortedBench.map((id) => renderPlayer(id))}
                </View>
              )}

              {taxi.length > 0 && (
                <View>
                  {renderGroupLabel('Taxi')}
                  {taxi.map((id) => renderPlayer(id))}
                </View>
              )}

              {reserve.length > 0 && (
                <View>
                  {renderGroupLabel('IR')}
                  {reserve.map((id) => renderPlayer(id))}
                </View>
              )}

              {sortedPicks.length > 0 && (
                <View>
                  {renderGroupLabel('Draft Picks')}
                  {sortedPicks.map((pick) => {
                    const pickId = getPickId(pick)
                    return (
                      <View
                        key={`${pick.season}-${pick.round}-${pick.roster_id}`}
                        className="flex-row items-center gap-1.5 px-2 py-1"
                      >
                        <View className="w-8 items-center rounded bg-gray-800">
                          <Text className="text-[10px] font-bold text-gray-500">PK</Text>
                        </View>
                        <Text className="flex-1 text-xs text-gray-400" numberOfLines={1}>
                          {pickId}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}
