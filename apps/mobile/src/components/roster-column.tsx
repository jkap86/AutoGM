import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import type { Allplayer, Roster } from '@autogm/shared'
import { getPickId } from '@autogm/shared'
import { getPickKtcName } from '../utils/value-lookup'

const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 }

export function RosterColumn({
  roster,
  allplayers,
  label,
  highlightIds,
  highlightColor,
  highlightPickIds,
  onToggle,
  onTogglePick,
  valueLookup,
  formatValue,
  rosterPositions,
}: {
  roster: Roster
  allplayers: { [id: string]: Allplayer }
  label: string
  highlightIds?: string[]
  highlightColor?: 'red' | 'green'
  highlightPickIds?: string[]
  onToggle?: (id: string) => void
  onTogglePick?: (pickId: string) => void
  valueLookup?: Record<string, number>
  formatValue?: (n: number) => string
  rosterPositions?: string[]
}) {
  const starterSlots = (rosterPositions ?? []).filter(
    (s) => s !== 'BN' && s !== 'IR' && s !== 'TAXI',
  )
  const starters = roster.starters.filter((id) => id !== '0')
  const taxi = roster.taxi ?? []
  const reserve = roster.reserve ?? []
  const bench = roster.players.filter(
    (id) => !starters.includes(id) && !taxi.includes(id) && !reserve.includes(id),
  )

  const sortedBench = [...bench].sort((a, b) => {
    const pa = allplayers[a]?.position ?? '?'
    const pb = allplayers[b]?.position ?? '?'
    const posA = POS_ORDER[pa] ?? 99
    const posB = POS_ORDER[pb] ?? 99
    if (posA !== posB) return posA - posB
    const va = valueLookup?.[a] ?? 0
    const vb = valueLookup?.[b] ?? 0
    return vb - va
  })

  const sortedPicks = [...roster.draftpicks].sort((a, b) => {
    if (a.season !== b.season) return a.season.localeCompare(b.season)
    if (a.round !== b.round) return a.round - b.round
    return (a.order ?? 99) - (b.order ?? 99)
  })

  const hlSet = new Set(highlightIds ?? [])
  const hlPickSet = new Set(highlightPickIds ?? [])
  const showValue = !!valueLookup
  const fmt = formatValue ?? ((n: number) => Math.round(n).toLocaleString())

  const renderPlayer = (id: string, slotLabel?: string) => {
    const p = allplayers[id]
    const name = p?.full_name || id
    const pos = slotLabel ?? p?.position ?? '?'
    const team = p?.team || ''
    const isHighlighted = hlSet.has(id)
    const hlBorder = highlightColor === 'red' ? 'border-l-2 border-red-500' : 'border-l-2 border-green-500'
    const hlBg = highlightColor === 'red' ? 'bg-red-900/30' : 'bg-green-900/30'

    return (
      <TouchableOpacity
        key={id}
        onPress={onToggle ? () => onToggle(id) : undefined}
        disabled={!onToggle}
        className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded ${isHighlighted ? `${hlBg} ${hlBorder}` : ''}`}
      >
        <Text className="w-7 text-center font-semibold text-gray-500 text-[10px]">{pos}</Text>
        <Text className={`flex-1 text-xs ${isHighlighted ? 'text-gray-100 font-medium' : 'text-gray-300'}`} numberOfLines={1}>
          {name}
        </Text>
        {team ? <Text className="text-gray-600 text-[10px]">{team}</Text> : null}
        {showValue && (
          <Text className="w-12 text-right text-xs font-medium text-blue-400">
            {valueLookup![id] != null ? fmt(valueLookup![id]) : '—'}
          </Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View className="flex-1 min-w-0">
      <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</Text>
      <ScrollView style={{ maxHeight: 288 }}>
        {starters.length > 0 && (
          <View className="mb-1.5">
            <Text className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">Starters</Text>
            {starters.map((id, i) => {
              const slot = starterSlots[roster.starters.indexOf(id)]
              return renderPlayer(id, slot)
            })}
          </View>
        )}

        {sortedBench.length > 0 && (
          <View className="mb-1.5">
            <Text className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">Bench</Text>
            {sortedBench.map((id) => renderPlayer(id))}
          </View>
        )}

        {taxi.length > 0 && (
          <View className="mb-1.5">
            <Text className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">Taxi</Text>
            {taxi.map((id) => renderPlayer(id))}
          </View>
        )}

        {reserve.length > 0 && (
          <View className="mb-1.5">
            <Text className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">IR</Text>
            {reserve.map((id) => renderPlayer(id))}
          </View>
        )}

        {sortedPicks.length > 0 && (
          <View className="mb-1.5">
            <Text className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">Draft Picks</Text>
            {sortedPicks.map((pick) => {
              const pickId = getPickId(pick)
              const isPickHl = hlPickSet.has(pickId)
              const ktcName = getPickKtcName(pick.season, pick.round, pick.order)
              const hlBorder = highlightColor === 'red' ? 'border-l-2 border-red-500' : 'border-l-2 border-green-500'
              const hlBg = highlightColor === 'red' ? 'bg-red-900/30' : 'bg-green-900/30'

              return (
                <TouchableOpacity
                  key={`${pick.season}-${pick.round}-${pick.roster_id}`}
                  onPress={onTogglePick ? () => onTogglePick(pickId) : undefined}
                  disabled={!onTogglePick}
                  className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded ${isPickHl ? `${hlBg} ${hlBorder}` : ''}`}
                >
                  <Text className="w-7 text-center font-semibold text-gray-600 text-[10px]">PK</Text>
                  <Text className={`flex-1 text-xs ${isPickHl ? 'text-gray-100 font-medium' : 'text-gray-400'}`} numberOfLines={1}>
                    {pickId}
                  </Text>
                  {showValue && (
                    <Text className="w-12 text-right text-xs font-medium text-blue-400">
                      {valueLookup![ktcName] != null ? fmt(valueLookup![ktcName]) : '—'}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
