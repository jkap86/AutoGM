import { View, Text, FlatList, ActivityIndicator, Image, StyleSheet } from 'react-native'
import { useAuth } from '@sleepier/shared'
import type { LeagueDetailed } from '@sleepier/shared'
import { useLeagues } from '../../src/hooks/use-leagues'

const SEASON = '2025'

function LeagueCard({ league }: { league: LeagueDetailed }) {
  const avatarUrl = league.avatar
    ? `https://sleepercdn.com/avatars/thumbs/${league.avatar}`
    : null

  return (
    <View style={s.card}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarPlaceholder]}>
          <Text style={{ fontSize: 18 }}>🏈</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.leagueName}>{league.name}</Text>
        <Text style={s.subtext}>
          {league.rosters.length} teams · {league.settings.type === 2 ? 'Dynasty' : 'Redraft'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.record}>
          {league.user_roster.wins}-{league.user_roster.losses}
          {league.user_roster.ties > 0 ? `-${league.user_roster.ties}` : ''}
        </Text>
        <Text style={s.pts}>{league.user_roster.fp.toFixed(1)} pts</Text>
      </View>
    </View>
  )
}

export default function LeaguesScreen() {
  const { session } = useAuth()
  const { leagues, loading, error } = useLeagues({
    user_id: session?.user_id,
    season: SEASON,
  })

  if (loading && !leagues) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text style={[s.subtext, { marginTop: 12 }]}>Loading leagues...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={{ color: '#F87171', textAlign: 'center' }}>{error}</Text>
      </View>
    )
  }

  const leagueList = leagues ? Object.values(leagues) : []

  return (
    <View style={s.container}>
      <FlatList
        data={leagueList}
        keyExtractor={(l) => l.league_id}
        renderItem={({ item }) => <LeagueCard league={item} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={[s.subtext, { textAlign: 'center', marginTop: 40 }]}>No leagues found</Text>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  leagueName: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  subtext: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  record: { color: '#60A5FA', fontWeight: '700', fontSize: 14 },
  pts: { color: '#6B7280', fontSize: 11, marginTop: 2 },
})
