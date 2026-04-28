import { useState, useMemo, useCallback, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native'
import type { LeagueDetailed, Roster, Allplayer } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useKtc } from '../../../src/hooks/use-ktc'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { colors } from '../../../src/theme'

type PositionFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICKS'

function getPickKtcName(season: string, round: number, order: number | null): string {
  const suffix = round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'
  if (order == null || order === 0) return `${season} Mid ${round}${suffix}`
  const type = order <= 4 ? 'Early' : order >= 9 ? 'Late' : 'Mid'
  return `${season} ${type} ${round}${suffix}`
}

function computeRosterValue(
  roster: Roster,
  filter: PositionFilter,
  ktc: Record<string, number>,
  allplayers: Record<string, Allplayer>,
): number {
  let total = 0
  if (filter !== 'PICKS') {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid]
      if (!player) continue
      if (filter !== 'ALL' && player.position !== filter) continue
      total += ktc[pid] ?? 0
    }
  }
  if (filter === 'ALL' || filter === 'PICKS') {
    for (const pick of roster.draftpicks ?? []) {
      const name = getPickKtcName(pick.season, pick.round, pick.order)
      total += ktc[name] ?? 0
    }
  }
  return total
}

function rankColor(rank: number, total: number): string {
  if (rank === 1) return colors.orange
  if (rank <= 3) return colors.green
  if (rank >= total - 2) return colors.red
  return colors.text
}

function LeagueRankCard({
  league,
  ktc,
  allplayers,
  posFilter,
}: {
  league: LeagueDetailed
  ktc: Record<string, number>
  allplayers: Record<string, Allplayer>
  posFilter: PositionFilter
}) {
  const [expanded, setExpanded] = useState(false)

  const ranked = useMemo(() => {
    const data = league.rosters.map((r) => ({
      roster: r,
      value: computeRosterValue(r, posFilter, ktc, allplayers),
    }))
    data.sort((a, b) => b.value - a.value)
    return data.map((d, i) => ({ ...d, rank: i + 1 }))
  }, [league, ktc, allplayers, posFilter])

  const userEntry = ranked.find((r) => r.roster.roster_id === league.user_roster.roster_id)

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.leagueName}>{league.name}</Text>
          <Text style={s.subtext}>
            {league.rosters.length} teams
          </Text>
        </View>
        {userEntry && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.rank, { color: rankColor(userEntry.rank, league.rosters.length) }]}>
              #{userEntry.rank}
            </Text>
            <Text style={s.value}>{Math.round(userEntry.value).toLocaleString()}</Text>
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
                <Text style={s.rankValue}>{Math.round(value).toLocaleString()}</Text>
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
  const { allplayers: allplayersMap, loading: apLoading } = useAllPlayers()
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')

  const leagueList = useMemo(() => (leagues ? Object.values(leagues) : []), [leagues])
  const loading = leaguesLoading || ktcLoading || apLoading

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setPosFilter(f)}
            style={[s.filterBtn, posFilter === f && s.filterBtnActive]}
          >
            <Text style={[s.filterText, posFilter === f && s.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={leagueList}
        keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => (
          <LeagueRankCard league={item} ktc={ktc} allplayers={allplayersMap} posFilter={posFilter} />
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
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
  filterBar: { borderBottomWidth: 1, borderBottomColor: colors.card, paddingVertical: 10 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  filterBtnActive: { backgroundColor: colors.blue },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  filterTextActive: { color: colors.white },
})
