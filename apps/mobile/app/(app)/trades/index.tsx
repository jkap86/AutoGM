import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native'
import { useAuth } from '@autogm/shared/react'
import type { Allplayer, LeagueDetailed, Roster } from '@autogm/shared'
import { getPickId } from '@autogm/shared'
import { SleeperTopics } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useKtc } from '../../../src/hooks/use-ktc'
import { useAdp } from '../../../src/hooks/use-adp'
import { type ValueType, buildValueLookup, formatValue as fmtValue, getPickKtcName } from '../../../src/utils/value-lookup'
import { useTradeValueFilter } from '../../../src/hooks/use-trade-value-filter'
import { TradeFilterBar } from '../../../src/components/trade-filter-bar'
import {
  useTradesByStatus,
  TradeWithLeague,
} from '../../../src/hooks/use-trades-by-status'
import { useTradeAction } from '../../../src/hooks/use-trade-action'
import { mobileDataClient } from '../../../src/data-client'
import { ErrorBoundary } from '../../../src/components/error-boundary'
import { useGatewayTopic } from '../../../src/contexts/socket-context'

import CreateTradeScreen from './create'

type Tab = 'create' | 'pending' | 'expired' | 'completed' | 'rejected'

function TradeCard({
  trade,
  allplayers,
  userId,
  leagues,
  valueLookup,
  valueType,
  onAction,
}: {
  trade: TradeWithLeague
  allplayers: Record<string, Allplayer>
  userId: string | null
  leagues: { [id: string]: LeagueDetailed }
  valueLookup: Record<string, number>
  valueType: ValueType
  onAction?: () => void
}) {
  const isReceived = trade.creator !== userId
  const isPending = trade.status === 'proposed'
  const league = leagues[trade.league_id]
  const userRosterId = league?.user_roster?.roster_id

  const adds = trade.adds ?? {}
  const sides: Record<number, { gets: string[] }> = {}
  for (const [pid, rid] of Object.entries(adds)) {
    if (!sides[rid]) sides[rid] = { gets: [] }
    sides[rid].gets.push(pid)
  }

  const date = new Date(trade.status_updated).toLocaleDateString()

  const { acting, execute } = useTradeAction()

  const tradeVars = {
    league_id: trade.league_id,
    transaction_id: trade.transaction_id,
    leg: trade.leg,
  }

  const handleAccept = useCallback(async () => {
    if (!userRosterId) return
    try {
      await execute('acceptTrade', tradeVars)
      onAction?.()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    }
  }, [execute, tradeVars, userRosterId, onAction])

  const handleReject = useCallback(async () => {
    if (!userRosterId) return
    try {
      await execute('rejectTrade', tradeVars)
      onAction?.()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    }
  }, [execute, tradeVars, userRosterId, onAction])

  const handleWithdraw = useCallback(async () => {
    if (!userRosterId) return
    try {
      await execute('rejectTrade', tradeVars)
      onAction?.()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    }
  }, [execute, tradeVars, userRosterId, onAction])

  const showActions = isPending && isReceived && userRosterId != null
  const showWithdraw = isPending && !isReceived && userRosterId != null
  const [expanded, setExpanded] = useState(false)
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterGive, setCounterGive] = useState<Set<string>>(new Set())
  const [counterReceive, setCounterReceive] = useState<Set<string>>(new Set())
  const [counterPicksGive, setCounterPicksGive] = useState<Set<string>>(new Set())
  const [counterPicksReceive, setCounterPicksReceive] = useState<Set<string>>(new Set())
  const [counterSending, setCounterSending] = useState(false)

  const partnerRid = trade.roster_ids.find((rid) => rid !== userRosterId)
  const partnerRoster = league?.rosters?.find((r) => r.roster_id === partnerRid)
  const userRoster = league?.user_roster

  const openCounter = useCallback((mode: 'counter' | 'modify') => {
    // Pre-populate from existing trade
    const adds = trade.adds ?? {}
    const give = new Set<string>()
    const receive = new Set<string>()
    for (const [pid, rid] of Object.entries(adds)) {
      if (rid === partnerRid) give.add(pid) // user gives → partner receives
      else receive.add(pid) // partner gives → user receives
    }
    setCounterGive(give)
    setCounterReceive(receive)
    // Pre-populate picks
    const pGive = new Set<string>()
    const pRecv = new Set<string>()
    for (const str of trade.draft_picks ?? []) {
      const [roster_id, season, round, owner_id, previous_owner_id] = str.split(',')
      if (+previous_owner_id === userRosterId) {
        const pick = userRoster?.draftpicks.find((d) => d.roster_id === +roster_id && d.season === season && d.round === +round)
        if (pick) pGive.add(getPickId(pick))
      } else {
        const pick = partnerRoster?.draftpicks.find((d) => d.roster_id === +roster_id && d.season === season && d.round === +round)
        if (pick) pRecv.add(getPickId(pick))
      }
    }
    setCounterPicksGive(pGive)
    setCounterPicksReceive(pRecv)
    setCounterOpen(true)
  }, [trade, partnerRid, userRosterId, userRoster, partnerRoster])

  const sendCounter = useCallback(async () => {
    if (!userRoster || !partnerRoster) return
    setCounterSending(true)
    try {
      const playersToGive = [...counterGive]
      const playersToReceive = [...counterReceive]
      await mobileDataClient.graphql('proposeTrade', {
        league_id: trade.league_id,
        k_adds: [...playersToGive, ...playersToReceive],
        v_adds: [
          ...playersToGive.map(() => partnerRoster.roster_id),
          ...playersToReceive.map(() => userRoster.roster_id),
        ],
        k_drops: [...playersToGive, ...playersToReceive],
        v_drops: [
          ...playersToGive.map(() => userRoster.roster_id),
          ...playersToReceive.map(() => partnerRoster.roster_id),
        ],
        draft_picks: [
          ...[...counterPicksGive].flatMap((pickId) => {
            const pick = userRoster.draftpicks.find((d) => getPickId(d) === pickId)
            if (!pick) return []
            return [`${pick.roster_id},${pick.season},${pick.round},${partnerRoster.roster_id},${userRoster.roster_id}`]
          }),
          ...[...counterPicksReceive].flatMap((pickId) => {
            const pick = partnerRoster.draftpicks.find((d) => getPickId(d) === pickId)
            if (!pick) return []
            return [`${pick.roster_id},${pick.season},${pick.round},${userRoster.roster_id},${partnerRoster.roster_id}`]
          }),
        ],
        waiver_budget: [],
        reject_transaction_id: trade.transaction_id,
        reject_transaction_leg: trade.leg,
      })
      setCounterOpen(false)
      Alert.alert('Sent', 'Counter offer sent')
      onAction?.()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    } finally {
      setCounterSending(false)
    }
  }, [trade, userRoster, partnerRoster, counterGive, counterReceive, counterPicksGive, counterPicksReceive, onAction])

  return (
    <View className="bg-gray-800 rounded-xl border border-gray-700/80 p-4 mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-white font-semibold text-sm font-heading">{trade.league_name}</Text>
        <View className="flex-row items-center gap-2">
          <View className={`px-2 py-0.5 rounded ${isReceived ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
            <Text className={`text-[11px] font-medium ${isReceived ? 'text-orange-400' : 'text-blue-400'}`}>
              {isReceived ? 'Received' : 'Outgoing'}
            </Text>
          </View>
          <Text className="text-gray-500 text-[11px]">{date}</Text>
        </View>
      </View>

      {(() => {
        // Parse picks
        const parsed = (trade.draft_picks ?? []).map((str) => {
          const [roster_id, season, round, owner_id, previous_owner_id] = str.split(',')
          return { roster_id: +roster_id, season, round: +round, owner_id: +owner_id, previous_owner_id: +previous_owner_id }
        })
        const findOrder = (rosterId: number, season: string, round: number) => {
          if (!league) return null
          for (const r of league.rosters) {
            const m = r.draftpicks.find((d) => d.roster_id === rosterId && String(d.season) === season && d.round === round)
            if (m?.order != null) return m.order
          }
          return null
        }

        // Build per-side data
        const rosterIds = [...new Set([...Object.values(adds), ...parsed.map((dp) => dp.owner_id)])]
        const sideData = rosterIds.map((rid) => {
          const roster = league?.rosters?.find((r) => r.roster_id === rid)
          const name = roster?.username ?? `Roster ${rid}`
          const isUser = rid === userRosterId
          const receivingPids = Object.entries(adds).filter(([, r]) => r === rid).map(([pid]) => pid)
          const receivingPicks = parsed.filter((dp) => dp.owner_id === rid)
          let playerVal = receivingPids.reduce((s, pid) => s + (valueLookup[pid] ?? 0), 0)
          let pickVal = receivingPicks.reduce((s, dp) => {
            const order = findOrder(dp.roster_id, dp.season, dp.round)
            return s + (valueLookup[getPickKtcName(dp.season, dp.round, order)] ?? 0)
          }, 0)
          return { rid, name, isUser, receivingPids, receivingPicks, total: playerVal + pickVal }
        })

        const userSide = sideData.find((s) => s.isUser)
        const partnerSide = sideData.find((s) => !s.isUser)
        const netSwing = (userSide?.total ?? 0) - (partnerSide?.total ?? 0)

        return (
          <View>
            {sideData.map((side) => (
              <View key={side.rid} className={`border-l-[3px] pl-2.5 mt-2 mb-1 ${side.isUser ? 'border-l-green-400' : 'border-l-red-400'}`}>
                <View className="flex-row justify-between mb-1">
                  <Text className={`text-[11px] font-semibold ${side.isUser ? 'text-green-400' : 'text-red-400'}`}>
                    {side.name} receives
                  </Text>
                  {side.total > 0 && <Text className="text-gray-500 text-[11px] font-semibold ml-1.5">{fmtValue(side.total, valueType)}</Text>}
                </View>
                {side.receivingPids.map((pid) => {
                  const p = allplayers[pid]
                  return (
                    <View key={pid} className="flex-row items-center mb-0.5">
                      <Text className="text-green-400 text-[13px]">
                        {p ? `${p.first_name} ${p.last_name}` : pid}
                        {p ? ` (${p.position ?? '?'} - ${p.team ?? 'FA'})` : ''}
                      </Text>
                      {valueLookup[pid] ? <Text className="text-gray-500 text-[11px] ml-1.5">{fmtValue(valueLookup[pid], valueType)}</Text> : null}
                    </View>
                  )
                })}
                {side.receivingPicks.map((dp, i) => {
                  const order = findOrder(dp.roster_id, dp.season, dp.round)
                  const label = order ? `${dp.season} ${dp.round}.${String(order).padStart(2, '0')}` : `${dp.season} Round ${dp.round}`
                  const val = valueLookup[getPickKtcName(dp.season, dp.round, order)] ?? 0
                  return (
                    <View key={i} className="flex-row items-center mb-0.5">
                      <Text className="text-blue-400 text-[13px] ml-2">{label}</Text>
                      {val > 0 && <Text className="text-gray-500 text-[11px] ml-1.5">{fmtValue(val, valueType)}</Text>}
                    </View>
                  )
                })}
              </View>
            ))}
            {userSide && partnerSide && (
              <View className="items-center py-1">
                <Text className={`font-bold text-[13px] ${netSwing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netSwing >= 0 ? '+' : ''}{fmtValue(netSwing, valueType)} net
                </Text>
              </View>
            )}
          </View>
        )
      })()}

      {showActions && (
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Accept Trade', 'Accept this trade?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Accept', onPress: handleAccept },
              ])
            }
            disabled={acting}
            className="flex-1 py-2 rounded-lg items-center bg-green-500/15"
          >
            <Text className="font-semibold text-[13px] text-green-400">{acting ? '...' : 'Accept'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Reject Trade', 'Reject this trade?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reject', style: 'destructive', onPress: handleReject },
              ])
            }
            disabled={acting}
            className="flex-1 py-2 rounded-lg items-center bg-red-500/15"
          >
            <Text className="font-semibold text-[13px] text-red-400">{acting ? '...' : 'Reject'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showActions && (
        <View className="flex-row gap-2 mt-1">
          <TouchableOpacity onPress={() => openCounter('counter')} className="flex-1 py-2 rounded-lg items-center bg-gray-800">
            <Text className="font-semibold text-[13px] text-blue-400">Counter</Text>
          </TouchableOpacity>
        </View>
      )}

      {showWithdraw && (
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity onPress={() => openCounter('modify')} className="flex-1 py-2 rounded-lg items-center bg-gray-800">
            <Text className="font-semibold text-[13px] text-blue-400">Modify</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Withdraw Trade', 'Withdraw this trade proposal?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Withdraw', style: 'destructive', onPress: handleWithdraw },
              ])
            }
            disabled={acting}
            className="flex-1 py-2 rounded-lg items-center bg-red-500/15"
          >
            <Text className="font-semibold text-[13px] text-orange-400">{acting ? '...' : 'Withdraw'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Counter/Modify Modal */}
      <Modal visible={counterOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-900">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
            <Text className="text-white text-[17px] font-bold font-heading">Counter Offer</Text>
            <TouchableOpacity onPress={() => setCounterOpen(false)}>
              <Text className="text-blue-400 text-[15px]">Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text className="text-gray-500 text-xs mb-3">
              Tap players/picks to toggle. Green = you receive, Red = you give.
            </Text>
            {userRoster && (
              <View className="mb-4">
                <Text className="text-blue-400 text-sm font-bold mb-1">{userRoster.username} (You)</Text>
                {userRoster.players.map((pid) => {
                  const p = allplayers[pid]
                  const isGiving = counterGive.has(pid)
                  return (
                    <TouchableOpacity key={pid} onPress={() => {
                      setCounterGive((prev) => { const n = new Set(prev); isGiving ? n.delete(pid) : n.add(pid); return n })
                      setCounterReceive((prev) => { const n = new Set(prev); n.delete(pid); return n })
                    }} className={`flex-row items-center py-0.5 ${isGiving ? 'bg-red-500/15' : ''}`}>
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">{p?.position ?? '?'}</Text>
                      <Text className={`flex-1 text-xs ${isGiving ? 'text-red-400' : 'text-gray-100'}`} numberOfLines={1}>{p?.full_name || pid}</Text>
                    </TouchableOpacity>
                  )
                })}
                {userRoster.draftpicks.map((pick) => {
                  const id = getPickId(pick)
                  const isGiving = counterPicksGive.has(id)
                  const label = pick.order ? `${pick.season} ${pick.round}.${String(pick.order).padStart(2, '0')}` : `${pick.season} Rd ${pick.round}`
                  return (
                    <TouchableOpacity key={id} onPress={() => {
                      setCounterPicksGive((prev) => { const n = new Set(prev); isGiving ? n.delete(id) : n.add(id); return n })
                    }} className={`flex-row items-center py-0.5 ${isGiving ? 'bg-red-500/15' : ''}`}>
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">PK</Text>
                      <Text className={`flex-1 text-xs ${isGiving ? 'text-red-400' : 'text-gray-100'}`}>{label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
            {partnerRoster && (
              <View className="mb-4">
                <Text className="text-gray-400 text-sm font-bold mb-1">{partnerRoster.username}</Text>
                {partnerRoster.players.map((pid) => {
                  const p = allplayers[pid]
                  const isReceiving = counterReceive.has(pid)
                  return (
                    <TouchableOpacity key={pid} onPress={() => {
                      setCounterReceive((prev) => { const n = new Set(prev); isReceiving ? n.delete(pid) : n.add(pid); return n })
                      setCounterGive((prev) => { const n = new Set(prev); n.delete(pid); return n })
                    }} className={`flex-row items-center py-0.5 ${isReceiving ? 'bg-green-500/15' : ''}`}>
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">{p?.position ?? '?'}</Text>
                      <Text className={`flex-1 text-xs ${isReceiving ? 'text-green-400' : 'text-gray-100'}`} numberOfLines={1}>{p?.full_name || pid}</Text>
                    </TouchableOpacity>
                  )
                })}
                {partnerRoster.draftpicks.map((pick) => {
                  const id = getPickId(pick)
                  const isReceiving = counterPicksReceive.has(id)
                  const label = pick.order ? `${pick.season} ${pick.round}.${String(pick.order).padStart(2, '0')}` : `${pick.season} Rd ${pick.round}`
                  return (
                    <TouchableOpacity key={id} onPress={() => {
                      setCounterPicksReceive((prev) => { const n = new Set(prev); isReceiving ? n.delete(id) : n.add(id); return n })
                    }} className={`flex-row items-center py-0.5 ${isReceiving ? 'bg-green-500/15' : ''}`}>
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">PK</Text>
                      <Text className={`flex-1 text-xs ${isReceiving ? 'text-green-400' : 'text-gray-100'}`}>{label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </ScrollView>
          <View className="p-4 border-t border-gray-700">
            <Text className="text-gray-500 text-xs text-center mb-2">
              Give {counterGive.size + counterPicksGive.size} · Receive {counterReceive.size + counterPicksReceive.size}
            </Text>
            <TouchableOpacity
              onPress={sendCounter}
              disabled={counterSending || (counterGive.size + counterPicksGive.size + counterReceive.size + counterPicksReceive.size === 0)}
              className={`bg-blue-600 rounded-xl p-3.5 items-center ${counterSending ? 'opacity-50' : ''}`}
            >
              <Text className="text-white text-[15px] font-bold">{counterSending ? 'Sending...' : 'Send Counter'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Expand/Collapse */}
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} className="items-center py-1.5 border-t border-gray-700 mt-2">
        <Text className="text-blue-400 text-xs font-medium">{expanded ? 'Hide Rosters' : 'View Rosters'}</Text>
      </TouchableOpacity>

      {expanded && userRoster && partnerRoster && (
        <View className="border-t border-gray-700 mt-1 pt-2">
          {[userRoster, partnerRoster].map((roster) => {
            const isUser = roster.roster_id === userRosterId
            const starters = roster.starters.filter((id) => id !== '0')
            const taxi = roster.taxi ?? []
            const reserve = roster.reserve ?? []
            const bench = roster.players.filter(
              (id) => !starters.includes(id) && !taxi.includes(id) && !reserve.includes(id),
            )
            return (
              <View key={roster.roster_id} className="mb-3">
                <Text className={`text-sm font-bold mb-1 ${isUser ? 'text-blue-400' : 'text-gray-400'}`}>
                  {roster.username}
                </Text>
                <Text className="text-gray-500 text-[10px] font-semibold uppercase mt-1.5 mb-0.5">Starters</Text>
                {starters.map((pid) => {
                  const p = allplayers[pid]
                  const v = valueLookup[pid] ?? 0
                  return (
                    <View key={pid} className="flex-row items-center py-0.5">
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">{p?.position ?? '?'}</Text>
                      <Text className="flex-1 text-gray-100 text-xs" numberOfLines={1}>{p?.full_name || pid}</Text>
                      {v > 0 && <Text className="text-blue-400 text-[11px] font-medium ml-1">{fmtValue(v, valueType)}</Text>}
                    </View>
                  )
                })}
                {bench.length > 0 && <Text className="text-gray-500 text-[10px] font-semibold uppercase mt-1.5 mb-0.5">Bench</Text>}
                {bench.map((pid) => {
                  const p = allplayers[pid]
                  const v = valueLookup[pid] ?? 0
                  return (
                    <View key={pid} className="flex-row items-center py-0.5">
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">{p?.position ?? '?'}</Text>
                      <Text className="flex-1 text-gray-100 text-xs" numberOfLines={1}>{p?.full_name || pid}</Text>
                      {v > 0 && <Text className="text-blue-400 text-[11px] font-medium ml-1">{fmtValue(v, valueType)}</Text>}
                    </View>
                  )
                })}
                {taxi.length > 0 && <Text className="text-gray-500 text-[10px] font-semibold uppercase mt-1.5 mb-0.5">Taxi</Text>}
                {taxi.map((pid) => {
                  const p = allplayers[pid]
                  return (
                    <View key={pid} className="flex-row items-center py-0.5">
                      <Text className="w-7 text-gray-500 text-[11px] font-semibold">{p?.position ?? '?'}</Text>
                      <Text className="flex-1 text-gray-100 text-xs" numberOfLines={1}>{p?.full_name || pid}</Text>
                    </View>
                  )
                })}
                {roster.draftpicks.length > 0 && <Text className="text-gray-500 text-[10px] font-semibold uppercase mt-1.5 mb-0.5">Picks</Text>}
                {roster.draftpicks
                  .slice()
                  .sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round)
                  .map((pick, i) => {
                    const label = pick.order
                      ? `${pick.season} ${pick.round}.${String(pick.order).padStart(2, '0')}`
                      : `${pick.season} Rd ${pick.round}`
                    const v = valueLookup[getPickKtcName(pick.season, pick.round, pick.order)] ?? 0
                    return (
                      <View key={i} className="flex-row items-center py-0.5">
                        <Text className="w-7 text-gray-500 text-[11px] font-semibold">PK</Text>
                        <Text className="flex-1 text-gray-100 text-xs">{label}</Text>
                        {v > 0 && <Text className="text-blue-400 text-[11px] font-medium ml-1">{fmtValue(v, valueType)}</Text>}
                      </View>
                    )
                  })}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function TradesContent() {
  const { session } = useAuth()
  const { leagues, loading: leaguesLoading } = useLeagueCache()
  const { allplayers } = useAllPlayers()
  const { ktc } = useKtc()
  const safeLeagues = leagues ?? {}

  const filter = useTradeValueFilter({ leagues: safeLeagues, allplayers, ktc })
  const { valueLookup, valueType, formatValue: fmtVal } = filter

  const [tab, setTab] = useState<Tab>('create')

  const { trades: pendingTrades, loading: pendingLoading, refetch: refetchPending } =
    useTradesByStatus(safeLeagues, 'proposed')
  const { trades: completedTrades, loading: completedLoading } =
    useTradesByStatus(safeLeagues, 'complete')
  const { trades: expiredTrades, loading: expiredLoading } =
    useTradesByStatus(safeLeagues, 'expired')
  const { trades: rejectedTrades, loading: rejectedLoading } =
    useTradesByStatus(safeLeagues, 'rejected')

  // Real-time trade updates via socket
  const IGNORE_EVENTS = useMemo(() => new Set([
    'phx_reply', 'phx_join', 'phx_close', 'presence_diff', 'presence_state',
    'message_created', 'typing', 'read_receipt',
  ]), [])
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useGatewayTopic(
    session?.user_id ? SleeperTopics.user(session.user_id) : null,
    useCallback((event: string) => {
      if (IGNORE_EVENTS.has(event)) return
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
      refetchTimerRef.current = setTimeout(() => { refetchPending() }, 2000)
    }, [IGNORE_EVENTS, refetchPending]),
  )

  const trades =
    tab === 'pending' ? pendingTrades
      : tab === 'expired' ? expiredTrades
        : tab === 'completed' ? completedTrades
          : rejectedTrades
  const isLoading =
    leaguesLoading ||
    (tab === 'pending' && pendingLoading) ||
    (tab === 'expired' && expiredLoading) ||
    (tab === 'completed' && completedLoading) ||
    (tab === 'rejected' && rejectedLoading)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'create', label: 'Create', count: 0 },
    { key: 'pending', label: 'Pending', count: pendingTrades.length },
    { key: 'expired', label: 'Expired', count: expiredTrades.length },
    { key: 'completed', label: 'Completed', count: completedTrades.length },
    { key: 'rejected', label: 'Rejected', count: rejectedTrades.length },
  ]

  return (
    <View className="flex-1 bg-gray-900">
      {/* Trade Filter Bar */}
      <View className="px-3 pt-2">
        <TradeFilterBar filter={filter} />
      </View>
      <View className="flex-row border-b border-gray-700 px-4">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`px-4 py-3 mr-1 ${tab === t.key ? 'border-b-2 border-b-blue-400' : ''}`}
          >
            <Text className={`text-[13px] font-medium font-heading ${tab === t.key ? 'text-white' : 'text-gray-500'}`}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'create' ? (
        <CreateTradeScreen />
      ) : isLoading && trades.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#60A5FA" />
        </View>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={(t) => t.transaction_id}
          renderItem={({ item }) => (
            <TradeCard
              trade={item}
              allplayers={allplayers}
              userId={session?.user_id ?? null}
              leagues={safeLeagues}
              valueLookup={valueLookup}
              valueType={valueType}
              onAction={tab === 'pending' ? refetchPending : undefined}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="text-gray-400 text-[11px] text-center mt-10">No {tab} trades</Text>
          }
        />
      )}
    </View>
  )
}

export default function TradesScreen() {
  return (
    <ErrorBoundary>
      <TradesContent />
    </ErrorBoundary>
  )
}
