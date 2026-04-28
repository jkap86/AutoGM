import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useAuth } from '@autogm/shared/react'
import type { Allplayer, LeagueDetailed } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useKtc } from '../../../src/hooks/use-ktc'
import { useAdp } from '../../../src/hooks/use-adp'
import { type ValueType, buildValueLookup, formatValue as fmtValue } from '../../../src/utils/value-lookup'
import {
  useTradesByStatus,
  TradeWithLeague,
} from '../../../src/hooks/use-trades-by-status'
import { useTradeAction } from '../../../src/hooks/use-trade-action'
import { ErrorBoundary } from '../../../src/components/error-boundary'
import { colors } from '../../../src/theme'

import CreateTradeScreen from './create'

type Tab = 'create' | 'pending' | 'completed' | 'rejected'

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

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.white600}>{trade.league_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.badge, isReceived ? s.badgeOrange : s.badgeBlue]}>
            <Text style={[s.badgeText, { color: isReceived ? colors.orange : colors.blueLight }]}>
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
                <View key={pid} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginBottom: 2 }}>
                  <Text style={s.playerAdd}>
                    + {p ? `${p.first_name} ${p.last_name}` : pid}
                    {p ? ` (${p.position ?? '?'} - ${p.team ?? 'FA'})` : ''}
                  </Text>
                  {valueLookup[pid] ? <Text style={s.ktcValue}>{fmtValue(valueLookup[pid], valueType)}</Text> : null}
                </View>
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
            <Text style={[s.actionText, { color: colors.green }]}>{acting ? '...' : 'Accept'}</Text>
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
            <Text style={[s.actionText, { color: colors.red }]}>{acting ? '...' : 'Reject'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showWithdraw && (
        <View style={s.actions}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Withdraw Trade', 'Withdraw this trade proposal?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Withdraw', style: 'destructive', onPress: handleWithdraw },
              ])
            }
            disabled={acting}
            style={[s.actionBtn, s.rejectBtn]}
          >
            <Text style={[s.actionText, { color: colors.orange }]}>{acting ? '...' : 'Withdraw'}</Text>
          </TouchableOpacity>
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
  const [valueType, setValueType] = useState<ValueType>('ktc')
  const isAdp = valueType === 'adp' || valueType === 'auction'
  const defaultStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  }, [])
  const { data: adpRows } = useAdp(
    { startDate: defaultStart, endDate: new Date().toISOString().slice(0, 10), minDrafts: 2 },
    isAdp,
  )
  const valueLookup = useMemo(
    () => buildValueLookup(valueType, ktc, adpRows),
    [valueType, ktc, adpRows],
  )
  const [tab, setTab] = useState<Tab>('create')

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
    { key: 'create', label: 'Create', count: 0 },
    { key: 'pending', label: 'Pending', count: pendingTrades.length },
    { key: 'completed', label: 'Completed', count: completedTrades.length },
    { key: 'rejected', label: 'Rejected', count: rejectedTrades.length },
  ]

  const valueTypes: ValueType[] = ['ktc', 'adp', 'auction']

  return (
    <View style={s.container}>
      {/* Value type toggle */}
      <View style={s.valueBar}>
        <View style={s.segmented}>
          {valueTypes.map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => setValueType(v)}
              style={[s.segBtn, valueType === v && s.segBtnActive]}
            >
              <Text style={[s.segText, valueType === v && s.segTextActive]}>{v.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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

      {tab === 'create' ? (
        <CreateTradeScreen />
      ) : isLoading && trades.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.blueLight} />
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
            <Text style={[s.label, { textAlign: 'center', marginTop: 40 }]}>No {tab} trades</Text>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  valueBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.card },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 8, padding: 2 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  segBtnActive: { backgroundColor: colors.blue },
  segText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  white600: { color: colors.white, fontWeight: '600', fontSize: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeOrange: { backgroundColor: colors.orangeBg },
  badgeBlue: { backgroundColor: colors.blueBg },
  badgeText: { fontSize: 11, fontWeight: '500' },
  dateText: { color: colors.textMuted, fontSize: 11 },
  label: { color: colors.textSecondary, fontSize: 11, marginBottom: 4 },
  playerAdd: { color: colors.green, fontSize: 13 },
  ktcValue: { color: colors.textMuted, fontSize: 11, marginLeft: 6 },
  pickText: { color: colors.blueLight, fontSize: 13, marginLeft: 8 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 12, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.blueLight },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  tabTextActive: { color: colors.white },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  acceptBtn: { backgroundColor: colors.greenBg },
  rejectBtn: { backgroundColor: colors.redBg },
  actionText: { fontWeight: '600', fontSize: 13 },
})
