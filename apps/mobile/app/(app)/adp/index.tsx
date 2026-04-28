import { useState, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, ScrollView } from 'react-native'
import type { Allplayer } from '@autogm/shared'
import { useAllPlayers } from '../../../src/hooks/use-allplayers'
import { useAdp } from '../../../src/hooks/use-adp'
import { colors } from '../../../src/theme'

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
    <View style={s.container}>
      {/* Filters */}
      <View style={s.filterRow}>
        <Text style={s.label}>From</Text>
        <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={s.dateInput} />
        <Text style={s.label}>To</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={s.dateInput} />
        <Text style={s.label}>Min</Text>
        <TextInput value={String(minDrafts)} onChangeText={(v) => setMinDrafts(Math.max(1, Number(v) || 1))} keyboardType="number-pad" style={[s.dateInput, { width: 36 }]} />
      </View>

      {/* Type + Stats */}
      <View style={s.typeRow}>
        {['', 'snake', 'auction', 'linear'].map((t) => (
          <TouchableOpacity key={t} onPress={() => setDraftType(t)} style={[s.typeBtn, draftType === t && s.typeBtnActive]}>
            <Text style={[s.typeText, draftType === t && s.typeTextActive]}>{t || 'Any'}</Text>
          </TouchableOpacity>
        ))}
        {stats && !loading && (
          <Text style={s.statsText}>{stats.n_drafts.toLocaleString()} drafts · {stats.n_leagues.toLocaleString()} leagues</Text>
        )}
      </View>

      {/* Position + Search */}
      <View style={s.posRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {positions.map((p) => (
            <TouchableOpacity key={p} onPress={() => setPosFilter(p)} style={[s.posBtn, posFilter === p && s.posBtnActive]}>
              <Text style={[s.posText, posFilter === p && s.posTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          placeholderTextColor={colors.textMuted}
          style={s.searchInput}
        />
      </View>

      {/* Results */}
      {loading && filtered.length === 0 ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.blueLight} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.player_id}
          ListHeaderComponent={
            <View style={s.headerRow}>
              <Text style={[s.headerCell, { flex: 2 }]}>Player</Text>
              <Text style={s.headerCell}>ADP</Text>
              <Text style={s.headerCell}>Min</Text>
              <Text style={s.headerCell}>Max</Text>
              <Text style={s.headerCell}>Stdev</Text>
              <Text style={s.headerCell}>Auc%</Text>
              <Text style={s.headerCell}>#</Text>
            </View>
          }
          renderItem={({ item }) => {
            const p = allplayers[item.player_id]
            return (
              <View style={s.row}>
                <View style={{ flex: 2 }}>
                  <Text style={s.playerName} numberOfLines={1}>{p?.full_name || item.player_id}</Text>
                  <Text style={s.playerDetail}>{p?.position ?? '?'} - {p?.team ?? 'FA'}</Text>
                </View>
                <Text style={s.cell}>{item.adp.toFixed(1)}</Text>
                <Text style={s.cell}>{item.min_pick}</Text>
                <Text style={s.cell}>{item.max_pick}</Text>
                <Text style={s.cell}>{item.stdev != null ? item.stdev.toFixed(1) : '-'}</Text>
                <Text style={s.cell}>{item.avg_pct != null ? `${(item.avg_pct * 100).toFixed(1)}` : '-'}</Text>
                <Text style={s.cell}>{item.n_drafts}</Text>
              </View>
            )
          }}
          ListEmptyComponent={<Text style={s.empty}>No results</Text>}
          ListFooterComponent={filtered.length >= 300 ? <Text style={s.footer}>Showing first 300 of {adpRows.length}</Text> : null}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.card, flexWrap: 'wrap' },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  dateInput: { backgroundColor: colors.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, color: colors.text, fontSize: 11, borderWidth: 1, borderColor: colors.border, width: 90 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.card },
  typeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.card },
  typeBtnActive: { backgroundColor: colors.blue },
  typeText: { color: colors.textMuted, fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  typeTextActive: { color: colors.white },
  statsText: { color: colors.textMuted, fontSize: 10, marginLeft: 'auto' },
  posRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.card },
  posBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.card },
  posBtnActive: { backgroundColor: colors.blue },
  posText: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  posTextActive: { color: colors.white },
  searchInput: { flex: 1, backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, color: colors.text, fontSize: 12, borderWidth: 1, borderColor: colors.border },
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.card + '40' },
  playerName: { color: colors.text, fontSize: 13, fontWeight: '500' },
  playerDetail: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  cell: { flex: 1, color: colors.text, fontSize: 12, textAlign: 'right' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 40, fontSize: 13 },
  footer: { color: colors.textMuted, textAlign: 'center', padding: 12, fontSize: 11 },
})
