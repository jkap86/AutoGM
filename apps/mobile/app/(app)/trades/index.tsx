import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useAuth, CURRENT_SEASON } from '@sleepier/shared'
import type { Allplayer, LeagueDetailed } from '@sleepier/shared'
import { useLeagues } from '../../../src/hooks/use-leagues'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import {
  useTradesByStatus,
  TradeWithLeague,
} from '../../../src/hooks/use-trades-by-status'
import { mobileDataClient } from '../../../src/data-client'

const SEASON = CURRENT_SEASON
type Tab = 'pending' | 'completed' | 'rejected'

function TradeCard({
  trade,
  allplayers,
  userId,
  leagues,
  onAction,
}: {
  trade: TradeWithLeague
  allplayers: Record<string, Allplayer>
  userId: string | null
  leagues: { [id: string]: LeagueDetailed }
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

  const [acting, setActing] = useState(false)

  const handleAccept = useCallback(async () => {
    if (!userRosterId) return
    setActing(true)
    try {
      await mobileDataClient.graphql('acceptTrade', {
        league_id: trade.league_id,
        transaction_id: trade.transaction_id,
        leg: trade.leg,
      })
      onAction?.()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    } finally {
      setActing(false)
    }
  }, [trade, userRosterId, onAction])

  const handleReject = useCallback(async () => {
    if (!userRosterId) return
    setActing(true)
    try {
      await mobileDataClient.graphql('rejectTrade', {
        league_id: trade.league_id,
        transaction_id: trade.transaction_id,
        leg: trade.leg,
      })
      onAction?.()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e))
    } finally {
      setActing(false)
    }
  }, [trade, userRosterId, onAction])

  const showActions = isPending && isReceived && userRosterId != null

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.white600}>{trade.league_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.badge, isReceived ? s.badgeOrange : s.badgeBlue]}>
            <Text style={[s.badgeText, { color: isReceived ? '#FB923C' : '#60A5FA' }]}>
              {isReceived ? 'Received' : 'Outgoing'}
            </Text>
          </View>
          <Text style={s.dateText}>{date}</Text>
        </View>
      </View>

      {Object.entries(sides).map(([rid, side]) => {
        const roster = league?.rosters?.find((r) => r.roster_id === Number(rid))
        const name = roster?.username ?? `Roster ${rid}`
        return (
          <View key={rid} style={{ marginTop: 8 }}>
            <Text style={s.label}>{name} receives:</Text>
            {side.gets.map((pid) => {
              const p = allplayers[pid]
              return (
                <Text key={pid} style={s.playerAdd}>
                  + {p ? `${p.first_name} ${p.last_name}` : pid}
                  {p ? ` (${p.position ?? '?'} - ${p.team ?? 'FA'})` : ''}
                </Text>
              )
            })}
          </View>
        )
      })}

      {(trade.draft_picks ?? []).length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={s.label}>Draft picks:</Text>
          {trade.draft_picks!.map((pick, i) => (
            <Text key={i} style={s.pickText}>{pick}</Text>
          ))}
        </View>
      )}

      {showActions && (
        <View style={s.actions}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Accept Trade', 'Accept this trade?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Accept', onPress: handleAccept },
              ])
            }
            disabled={acting}
            style={[s.actionBtn, s.acceptBtn]}
          >
            <Text style={s.actionText}>{acting ? '...' : 'Accept'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Reject Trade', 'Reject this trade?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reject', style: 'destructive', onPress: handleReject },
              ])
            }
            disabled={acting}
            style={[s.actionBtn, s.rejectBtn]}
          >
            <Text style={s.actionText}>{acting ? '...' : 'Reject'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export default function TradesScreen() {
  const { session } = useAuth()
  const { leagues, loading: leaguesLoading } = useLeagues({
    user_id: session?.user_id,
    season: SEASON,
  })
  const { allplayers } = useAllPlayers()
  const [tab, setTab] = useState<Tab>('pending')

  const safeLeagues = leagues ?? {}

  const { trades: pendingTrades, loading: pendingLoading, refetch: refetchPending } =
    useTradesByStatus(safeLeagues, 'proposed')
  const { trades: completedTrades, loading: completedLoading } =
    useTradesByStatus(safeLeagues, 'complete')
  const { trades: rejectedTrades, loading: rejectedLoading } =
    useTradesByStatus(safeLeagues, 'rejected')

  const trades =
    tab === 'pending' ? pendingTrades
      : tab === 'completed' ? completedTrades
        : rejectedTrades
  const isLoading =
    leaguesLoading ||
    (tab === 'pending' && pendingLoading) ||
    (tab === 'completed' && completedLoading) ||
    (tab === 'rejected' && rejectedLoading)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingTrades.length },
    { key: 'completed', label: 'Completed', count: completedTrades.length },
    { key: 'rejected', label: 'Rejected', count: rejectedTrades.length },
  ]

  return (
    <View style={s.container}>
      <View style={s.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[s.tab, tab === t.key && s.tabActive]}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && trades.length === 0 ? (
        <View style={s.center}>
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
              onAction={tab === 'pending' ? refetchPending : undefined}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={[s.label, { textAlign: 'center', marginTop: 40 }]}>No {tab} trades</Text>
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  white600: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeOrange: { backgroundColor: 'rgba(249,115,22,0.2)' },
  badgeBlue: { backgroundColor: 'rgba(59,130,246,0.2)' },
  badgeText: { fontSize: 11, fontWeight: '500' },
  dateText: { color: '#6B7280', fontSize: 11 },
  label: { color: '#9CA3AF', fontSize: 11, marginBottom: 4 },
  playerAdd: { color: '#4ADE80', fontSize: 13, marginLeft: 8 },
  pickText: { color: '#60A5FA', fontSize: 13, marginLeft: 8 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#374151', paddingHorizontal: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 12, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#60A5FA' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#FFF' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  acceptBtn: { backgroundColor: 'rgba(34,197,94,0.15)' },
  rejectBtn: { backgroundColor: 'rgba(239,68,68,0.15)' },
  actionText: { fontWeight: '600', fontSize: 13, color: '#FFF' },
})
