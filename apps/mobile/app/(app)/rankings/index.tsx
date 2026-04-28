import { useState, useMemo, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, ScrollView } from 'react-native'
import type { LeagueDetailed, Roster, Allplayer } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useKtc } from '../../../src/hooks/use-ktc'
import { useAdp } from '../../../src/hooks/use-adp'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { type ValueType, buildValueLookup, formatValue, getPickKtcName } from '../../../src/utils/value-lookup'
import { mobileDataClient } from '../../../src/data-client'
import { colors } from '../../../src/theme'

type PositionFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICKS'

function computeRosterValue(
  roster: Roster,
  filter: PositionFilter,
  values: Record<string, number>,
  allplayers: Record<string, Allplayer>,
  topN: number = 0,
): number {
  const vals: number[] = []
  if (filter !== 'PICKS') {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid]
      if (!player) continue
      if (filter !== 'ALL' && player.position !== filter) continue
      vals.push(values[pid] ?? 0)
    }
  }
  if (filter === 'ALL' || filter === 'PICKS') {
    for (const pick of roster.draftpicks ?? []) {
      const name = getPickKtcName(pick.season, pick.round, pick.order)
      vals.push(values[name] ?? 0)
    }
  }
  vals.sort((a, b) => b - a)
  const sliced = topN > 0 ? vals.slice(0, topN) : vals
  return sliced.reduce((a, b) => a + b, 0)
}

function rankColor(rank: number, total: number): string {
  if (rank === 1) return colors.orange
  if (rank <= 3) return colors.green
  if (rank >= total - 2) return colors.red
  return colors.text
}

function LeagueRankCard({
  league, values, allplayers, posFilter, valueType, topN,
}: {
  league: LeagueDetailed
  values: Record<string, number>
  allplayers: Record<string, Allplayer>
  posFilter: PositionFilter
  valueType: ValueType
  topN: number
}) {
  const [expanded, setExpanded] = useState(false)

  const ranked = useMemo(() => {
    const data = league.rosters.map((r) => ({
      roster: r,
      value: computeRosterValue(r, posFilter, values, allplayers, topN),
    }))
    data.sort((a, b) => b.value - a.value)
    return data.map((d, i) => ({ ...d, rank: i + 1 }))
  }, [league, values, allplayers, posFilter])

  const userEntry = ranked.find((r) => r.roster.roster_id === league.user_roster.roster_id)

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.leagueName}>{league.name}</Text>
          <Text style={s.subtext}>{league.rosters.length} teams</Text>
        </View>
        {userEntry && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.rank, { color: rankColor(userEntry.rank, league.rosters.length) }]}>
              #{userEntry.rank}
            </Text>
            <Text style={s.value}>{formatValue(userEntry.value, valueType)}</Text>
          </View>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={s.expandedList}>
          {ranked.map(({ roster, value, rank }) => {
            const isUser = roster.roster_id === league.user_roster.roster_id
            return (
              <View key={roster.roster_id} style={[s.rankRow, isUser && s.rankRowUser]}>
                <Text style={[s.rankNum, { color: rankColor(rank, league.rosters.length) }]}>
                  #{rank}
                </Text>
                <Text style={[s.rankName, isUser && { color: colors.blueLight }]} numberOfLines={1}>
                  {roster.username}
                </Text>
                <Text style={s.rankValue}>{formatValue(value, valueType)}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

export default function RankingsScreen() {
  const { leagues, loading: leaguesLoading } = useLeagueCache()
  const { ktc, loading: ktcLoading } = useKtc()
  const { allplayers, loading: apLoading } = useAllPlayers()
  const [valueType, setValueType] = useState<ValueType>('ktc')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')
  const [topN, setTopN] = useState(0)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [ktcDate, setKtcDate] = useState(today)
  const [ktcHistorical, setKtcHistorical] = useState<Record<string, number> | null>(null)

  // ADP filters
  const isAdp = valueType === 'adp' || valueType === 'auction'
  const defaultStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  }, [])
  const [adpStart, setAdpStart] = useState(defaultStart)
  const [adpEnd, setAdpEnd] = useState(today)
  const [draftType, setDraftType] = useState<string>('')
  const [minDrafts, setMinDrafts] = useState(2)

  const { data: adpRows, stats: adpStats, loading: adpLoading } = useAdp(
    { startDate: adpStart, endDate: adpEnd, draftType: draftType || null, minDrafts } as any,
    isAdp,
  )

  // KTC date fetch
  useEffect(() => {
    if (valueType !== 'ktc' || ktcDate === today) {
      setKtcHistorical(null)
      return
    }
    mobileDataClient.fetchKtcByDate(ktcDate).then((d) => setKtcHistorical(d.player_values)).catch(() => {})
  }, [ktcDate, valueType, today])

  const valueLookup = useMemo(() => {
    if (valueType === 'ktc') return ktcHistorical ?? ktc
    return buildValueLookup(valueType, ktc, adpRows)
  }, [valueType, ktc, ktcHistorical, adpRows])

  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])
  const loading = leaguesLoading || ktcLoading || apLoading || (isAdp && adpLoading)

  const valueTypes: ValueType[] = ['ktc', 'adp', 'auction']
  const filters: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE', 'PICKS']

  if (loading && leagueList.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blueLight} />
        <Text style={[s.subtext, { marginTop: 12 }]}>Loading rankings...</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Value type toggle */}
      <View style={s.controlBar}>
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
        {isAdp && adpStats && !adpLoading && (
          <Text style={s.statsText}>{adpStats.n_drafts.toLocaleString()} drafts</Text>
        )}
        {loading && <ActivityIndicator size="small" color={colors.blueLight} style={{ marginLeft: 8 }} />}
      </View>

      {/* Source-specific filters */}
      {valueType === 'ktc' && (
        <View style={s.filterRow}>
          <Text style={s.filterLabel}>Date</Text>
          <TextInput
            value={ktcDate}
            onChangeText={setKtcDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            style={s.dateInput}
          />
          {ktcDate !== today && (
            <TouchableOpacity onPress={() => setKtcDate(today)}>
              <Text style={{ color: colors.blueLight, fontSize: 12 }}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {isAdp && (
        <View style={s.filterRow}>
          <Text style={s.filterLabel}>From</Text>
          <TextInput value={adpStart} onChangeText={setAdpStart} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={s.dateInput} />
          <Text style={s.filterLabel}>To</Text>
          <TextInput value={adpEnd} onChangeText={setAdpEnd} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={s.dateInput} />
          <Text style={s.filterLabel}>Min</Text>
          <TextInput value={String(minDrafts)} onChangeText={(v) => setMinDrafts(Math.max(1, Number(v) || 1))} keyboardType="number-pad" style={[s.dateInput, { width: 36 }]} />
        </View>
      )}

      {/* Position filter + Top N */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, alignItems: 'center' }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setPosFilter(f)}
            style={[s.filterBtn, posFilter === f && s.filterBtnActive]}
          >
            <Text style={[s.filterText, posFilter === f && s.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 }} />
        <Text style={s.topNLabel}>Top</Text>
        <TouchableOpacity
          onPress={() => setTopN(0)}
          style={[s.filterBtn, topN === 0 && s.filterBtnActive]}
        >
          <Text style={[s.filterText, topN === 0 && s.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TextInput
          value={topN > 0 ? String(topN) : ''}
          onChangeText={(v) => setTopN(v === '' ? 0 : Math.max(0, Number(v)))}
          placeholder="N"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={s.topNInput}
        />
      </ScrollView>

      <FlatList
        data={leagueList}
        keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => (
          <LeagueRankCard
            league={item}
            values={valueLookup}
            allplayers={allplayers}
            posFilter={posFilter}
            valueType={valueType}
            topN={topN}
          />
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  controlBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.card },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 8, padding: 2 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  segBtnActive: { backgroundColor: colors.blue },
  segText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: colors.white },
  statsText: { color: colors.textMuted, fontSize: 11, marginLeft: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.card, flexWrap: 'wrap' },
  filterLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  dateInput: { backgroundColor: colors.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, color: colors.text, fontSize: 11, borderWidth: 1, borderColor: colors.border, width: 90 },
  card: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  leagueName: { color: colors.white, fontWeight: '600', fontSize: 15 },
  subtext: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rank: { fontSize: 18, fontWeight: '800' },
  value: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  expandedList: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  rankRowUser: { backgroundColor: 'rgba(59,130,246,0.1)' },
  rankNum: { width: 32, fontSize: 13, fontWeight: '700' },
  rankName: { flex: 1, color: colors.text, fontSize: 13 },
  rankValue: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  topNLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  topNInput: { width: 36, backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, color: colors.text, fontSize: 12, textAlign: 'center', borderWidth: 1, borderColor: colors.border },
  filterBar: { borderBottomWidth: 1, borderBottomColor: colors.card, paddingVertical: 10 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  filterBtnActive: { backgroundColor: colors.blue },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  filterTextActive: { color: colors.white },
})
