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
} from 'react-native'
import { randomId } from '@autogm/shared'
import type { LeagueDetailed } from '@autogm/shared'
import { useLeagueCache } from '../../../src/league-cache'
import { useCreatePoll } from '../../../src/hooks/use-create-poll'
import { usePolls, addPoll, type PollGroup } from '../../../src/hooks/use-polls'
import { ErrorBoundary } from '../../../src/components/error-boundary'

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
    <ScrollView className="flex-1 bg-gray-900" contentContainerStyle={{ padding: 16 }}>
      <View className="bg-gray-800 rounded-xl p-4 mb-3">
        <View className="flex-row justify-between mb-3">
          <Text className="text-white font-semibold text-[15px]">New Poll</Text>
          <TouchableOpacity onPress={onDone}>
            <Text className="text-blue-400 text-[13px]">Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-gray-400 text-xs font-medium mb-1">Question</Text>
        <TextInput
          className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask a question..."
          placeholderTextColor="#6B7280"
        />

        <Text className="text-gray-400 text-xs font-medium mb-1 mt-3">Choices</Text>
        {choices.map((c, i) => (
          <View key={i} className="flex-row items-center mb-1.5">
            <TextInput
              className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm flex-1"
              value={c}
              onChangeText={(v) => updateChoice(i, v)}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor="#6B7280"
            />
            {choices.length > 2 && (
              <TouchableOpacity onPress={() => removeChoice(i)} className="ml-2">
                <Text className="text-red-400 text-lg">&times;</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={addChoice}>
          <Text className="text-blue-400 text-[13px]">+ Add choice</Text>
        </TouchableOpacity>

        <View className="flex-row gap-3 mt-3">
          <View className="flex-1">
            <Text className="text-gray-400 text-xs font-medium mb-1">Type</Text>
            <View className="flex-row rounded-lg overflow-hidden border border-gray-700">
              {(['single', 'multiple'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setPollType(t)}
                  className={`flex-1 py-1.5 items-center ${pollType === t ? 'bg-blue-600' : 'bg-gray-900'}`}
                >
                  <Text className={`text-xs font-medium ${pollType === t ? 'text-white' : 'text-gray-500'}`}>
                    {t === 'single' ? 'Single' : 'Multi'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-gray-400 text-xs font-medium mb-1">Privacy</Text>
            <View className="flex-row rounded-lg overflow-hidden border border-gray-700">
              {(['public', 'anonymous'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPrivacy(p)}
                  className={`flex-1 py-1.5 items-center ${privacy === p ? 'bg-blue-600' : 'bg-gray-900'}`}
                >
                  <Text className={`text-xs font-medium ${privacy === p ? 'text-white' : 'text-gray-500'}`}>
                    {p === 'public' ? 'Public' : 'Anon'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text className="text-gray-400 text-xs font-medium mb-1 mt-3">
          Leagues{selected.length > 0 ? ` (${selected.length})` : ''}
        </Text>
        <View className="border border-gray-700 rounded-lg max-h-40 overflow-hidden">
          {entries.map(([id, league]) => (
            <TouchableOpacity
              key={id}
              onPress={() => toggleLeague(id)}
              className={`px-3 py-2 ${selected.includes(id) ? 'bg-blue-600/10' : ''}`}
            >
              <Text className={`text-[13px] ${selected.includes(id) ? 'text-white' : 'text-gray-400'}`}>
                {selected.includes(id) ? '☑ ' : '☐ '}{league.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text className="text-red-400 text-xs mt-2">{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          className={`bg-blue-600 rounded-lg py-2.5 px-6 items-center mt-3 ${!canSubmit ? 'opacity-50' : ''}`}
        >
          <Text className="text-white font-semibold text-sm">{loading ? 'Posting...' : 'Create Poll'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ---- Vote Bar (visual) ----

function VoteBar({ choice, count, total }: { choice: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <View className="my-0.5">
      <View className="flex-row justify-between mb-0.5">
        <Text className="text-white text-[13px]" numberOfLines={1}>
          {choice}
        </Text>
        <Text className="text-gray-500 text-[11px]">
          {count} · {pct}%
        </Text>
      </View>
      <View className="h-1.5 rounded-full bg-gray-700">
        <View className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
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
    <View className="bg-gray-800 rounded-xl p-4 mb-3">
      <View className="flex-row justify-between mb-2">
        <View className="flex-1">
          <Text className="text-white font-semibold text-[15px]">{group.prompt}</Text>
          <Text className="text-gray-500 text-[11px]">
            {group.poll_type} · {group.privacy}
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove}>
          <Text className="text-gray-500 text-[11px]">Remove</Text>
        </TouchableOpacity>
      </View>

      {group.polls.length > 1 && (
        <View className="bg-gray-900/50 rounded-lg p-2.5 mb-1">
          <Text className="text-gray-400 text-[11px] mb-1">
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
          <View key={poll.poll_id} className="mt-2">
            <Text className="text-gray-400 text-[11px] mb-0.5">
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
    <View className="flex-1 bg-gray-900">
      <View className="p-4 items-center flex-row justify-center gap-3">
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          disabled={leaguesLoading || Object.keys(safeLeagues).length === 0}
          className={`bg-blue-600 rounded-lg py-2.5 px-6 items-center mt-3 ${leaguesLoading ? 'opacity-50' : ''}`}
        >
          <Text className="text-white font-semibold text-sm">Create Poll</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={refetch} className="px-3 py-2">
          <Text className="text-gray-500 text-[13px]">Refresh</Text>
        </TouchableOpacity>
      </View>

      {(loading || leaguesLoading) && groups.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#60A5FA" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-red-400">{error}</Text>
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">No polls yet.</Text>
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
