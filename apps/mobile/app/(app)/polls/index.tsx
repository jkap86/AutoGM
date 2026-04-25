import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native'
import { randomId } from '@sleepier/shared'
import type { LeagueDetailed } from '@sleepier/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useCreatePoll } from '../../../src/hooks/use-create-poll'
import { usePolls, addPoll, type PollGroup } from '../../../src/hooks/use-polls'
import { ErrorBoundary } from '../../../src/components/error-boundary'
import { colors } from '../../../src/theme'

// ---- Create Poll Form ----

function CreatePollForm({
  leagues,
  onDone,
}: {
  leagues: { [id: string]: LeagueDetailed }
  onDone: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [choices, setChoices] = useState(['', ''])
  const [pollType, setPollType] = useState<'single' | 'multiple'>('single')
  const [privacy, setPrivacy] = useState<'public' | 'anonymous'>('public')
  const [selected, setSelected] = useState<string[]>([])
  const { createPoll, loading, error } = useCreatePoll()

  const updateChoice = (i: number, val: string) =>
    setChoices((prev) => prev.map((c, j) => (j === i ? val : c)))
  const addChoice = () => setChoices((prev) => [...prev, ''])
  const removeChoice = (i: number) =>
    setChoices((prev) => prev.filter((_, j) => j !== i))
  const toggleLeague = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const valid = prompt.trim() && choices.filter((c) => c.trim()).length >= 2 && selected.length > 0
  const canSubmit = valid && !loading

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    const validChoices = choices.filter((c) => c.trim())
    const groupId = randomId()
    for (let i = 0; i < selected.length; i++) {
      const result = await createPoll({
        group_id: groupId,
        league_id: selected[i],
        prompt: prompt.trim(),
        choices: validChoices,
        poll_type: pollType,
        privacy,
      })
      await addPoll({
        poll_id: result.poll_id,
        group_id: groupId,
        league_id: selected[i],
        prompt: prompt.trim(),
        choices: validChoices,
        choices_order: result.choices_order,
        poll_type: pollType,
        privacy,
        created_at: Date.now(),
      })
      if (i < selected.length - 1) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000))
      }
    }
    onDone()
  }, [canSubmit, choices, selected, prompt, pollType, privacy, createPoll, onDone])

  const entries = Object.entries(leagues)

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={s.heading}>New Poll</Text>
          <TouchableOpacity onPress={onDone}>
            <Text style={s.link}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Question</Text>
        <TextInput
          style={s.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask a question..."
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[s.label, { marginTop: 12 }]}>Choices</Text>
        {choices.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={c}
              onChangeText={(v) => updateChoice(i, v)}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={colors.textMuted}
            />
            {choices.length > 2 && (
              <TouchableOpacity onPress={() => removeChoice(i)} style={{ marginLeft: 8 }}>
                <Text style={{ color: colors.red, fontSize: 18 }}>&times;</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={addChoice}>
          <Text style={s.link}>+ Add choice</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Type</Text>
            <View style={s.segmented}>
              {(['single', 'multiple'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setPollType(t)}
                  style={[s.segBtn, pollType === t && s.segBtnActive]}
                >
                  <Text style={[s.segText, pollType === t && s.segTextActive]}>
                    {t === 'single' ? 'Single' : 'Multi'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Privacy</Text>
            <View style={s.segmented}>
              {(['public', 'anonymous'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPrivacy(p)}
                  style={[s.segBtn, privacy === p && s.segBtnActive]}
                >
                  <Text style={[s.segText, privacy === p && s.segTextActive]}>
                    {p === 'public' ? 'Public' : 'Anon'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={[s.label, { marginTop: 12 }]}>
          Leagues{selected.length > 0 ? ` (${selected.length})` : ''}
        </Text>
        <View style={s.leagueList}>
          {entries.map(([id, league]) => (
            <TouchableOpacity
              key={id}
              onPress={() => toggleLeague(id)}
              style={[s.leagueRow, selected.includes(id) && s.leagueRowActive]}
            >
              <Text style={[s.leagueText, selected.includes(id) && { color: colors.white }]}>
                {selected.includes(id) ? '☑ ' : '☐ '}{league.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={{ color: colors.red, fontSize: 12, marginTop: 8 }}>{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[s.submitBtn, !canSubmit && { opacity: 0.5 }]}
        >
          <Text style={s.submitText}>{loading ? 'Posting...' : 'Create Poll'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ---- Vote Bar (visual) ----

function VoteBar({ choice, count, total }: { choice: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <View style={{ marginVertical: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>
          {choice}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {count} · {pct}%
        </Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  )
}

// ---- Poll Group Card ----

function PollGroupCard({
  group,
  leagues,
  onRemove,
}: {
  group: PollGroup
  leagues: { [id: string]: LeagueDetailed }
  onRemove: () => void
}) {
  const aggTotal = group.aggregateVotes.length
  const aggCounts: Record<string, number> = {}
  for (const vote of group.aggregateVotes) {
    aggCounts[vote.choice_id] = (aggCounts[vote.choice_id] ?? 0) + 1
  }

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.heading}>{group.prompt}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {group.poll_type} · {group.privacy}
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>Remove</Text>
        </TouchableOpacity>
      </View>

      {group.polls.length > 1 && (
        <View style={s.aggregate}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>
            Aggregate · {group.polls.length} leagues · {aggTotal} vote{aggTotal !== 1 ? 's' : ''}
          </Text>
          {group.choices.map((choice, i) => (
            <VoteBar key={i} choice={choice} count={aggCounts[String(i)] ?? 0} total={aggTotal} />
          ))}
        </View>
      )}

      {group.polls.map((poll) => {
        const leagueName = leagues[poll.league_id]?.name ?? poll.league_id
        const order = poll.choices_order ?? []
        const voteCounts: Record<string, number> = {}
        for (const v of poll.votes) voteCounts[v.choice_id] = (voteCounts[v.choice_id] ?? 0) + 1
        const totalVotes = poll.votes.length
        return (
          <View key={poll.poll_id} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 2 }}>
              {leagueName} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
            </Text>
            {poll.choices.map((choice, i) => {
              const choiceId = order[i]
              const count = choiceId ? (voteCounts[choiceId] ?? 0) : 0
              return <VoteBar key={i} choice={choice} count={count} total={totalVotes} />
            })}
          </View>
        )
      })}
    </View>
  )
}

// ---- Main Screen ----

function PollsContent() {
  const { leagues, loading: leaguesLoading } = useLeagueCache()
  const { groups, loading, error, refetch, removeGroup } = usePolls()
  const [showCreate, setShowCreate] = useState(false)

  const safeLeagues = leagues ?? {}

  if (showCreate && Object.keys(safeLeagues).length > 0) {
    return (
      <CreatePollForm
        leagues={safeLeagues}
        onDone={() => {
          setShowCreate(false)
          refetch()
        }}
      />
    )
  }

  return (
    <View style={s.container}>
      <View style={{ padding: 16, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          disabled={leaguesLoading || Object.keys(safeLeagues).length === 0}
          style={[s.submitBtn, { opacity: leaguesLoading ? 0.5 : 1 }]}
        >
          <Text style={s.submitText}>Create Poll</Text>
        </TouchableOpacity>
      </View>

      {(loading || leaguesLoading) && groups.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.blueLight} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={{ color: colors.red }}>{error}</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={s.center}>
          <Text style={{ color: colors.textSecondary }}>No polls yet.</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.group_id}
          renderItem={({ item }) => (
            <PollGroupCard
              group={item}
              leagues={safeLeagues}
              onRemove={() =>
                Alert.alert('Remove Poll', 'Remove this poll from all leagues?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeGroup(item.group_id) },
                ])
              }
            />
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  )
}

export default function PollsScreen() {
  return (
    <ErrorBoundary>
      <PollsContent />
    </ErrorBoundary>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: colors.white, fontWeight: '600', fontSize: 15 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '500', marginBottom: 4 },
  link: { color: colors.blueLight, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.white,
    fontSize: 14,
  },
  segmented: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', backgroundColor: colors.surface },
  segBtnActive: { backgroundColor: colors.blue },
  segText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  segTextActive: { color: colors.white },
  leagueList: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, maxHeight: 160, overflow: 'hidden' },
  leagueRow: { paddingHorizontal: 12, paddingVertical: 8 },
  leagueRowActive: { backgroundColor: 'rgba(37,99,235,0.1)' },
  leagueText: { color: colors.textSecondary, fontSize: 13 },
  submitBtn: {
    backgroundColor: colors.blue,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  submitText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  aggregate: { backgroundColor: 'rgba(17,24,39,0.5)', borderRadius: 8, padding: 10, marginBottom: 4 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.barTrack },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.barFill },
})
