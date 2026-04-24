import { useState } from "react";
import type { LeagueDetailed } from "@sleepier/shared";
import { useCreatePoll } from "../../hooks/use-create-poll";
import { usePolls, PollGroup } from "../../hooks/use-polls";
import { Avatar } from "../components/avatar";

export default function PollsView({
  leagues,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {showCreate ? (
        <CreatePolls leagues={leagues} setShowCreate={setShowCreate} />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          Create Poll
        </button>
      )}
      <PollsList leagues={leagues} />
    </div>
  );
}

function CreatePolls({
  leagues,
  setShowCreate,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  setShowCreate: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [pollType, setPollType] = useState<"single" | "multiple">("single");
  const [privacy, setPrivacy] = useState<"public" | "anonymous">("public");
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);

  const { createPoll, loading, error } = useCreatePoll();

  const addChoice = () => setChoices((prev) => [...prev, ""]);
  const removeChoice = (index: number) =>
    setChoices((prev) => prev.filter((_, i) => i !== index));
  const updateChoice = (index: number, value: string) =>
    setChoices((prev) => prev.map((c, i) => (i === index ? value : c)));

  const toggleLeague = (leagueId: string) =>
    setSelectedLeagues((prev) =>
      prev.includes(leagueId)
        ? prev.filter((id) => id !== leagueId)
        : [...prev, leagueId],
    );

  const canSubmit =
    prompt.trim() !== "" &&
    choices.filter((c) => c.trim() !== "").length >= 2 &&
    selectedLeagues.length > 0 &&
    !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    const validChoices = choices.filter((c) => c.trim() !== "");
    const groupId = crypto.randomUUID();
    for (let i = 0; i < selectedLeagues.length; i++) {
      await createPoll({
        group_id: groupId,
        league_id: selectedLeagues[i],
        prompt,
        choices: validChoices,
        k_metadata: ["poll_type", "privacy"],
        v_metadata: [pollType, privacy],
      });
      if (i < selectedLeagues.length - 1) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
      }
    }
    setShowCreate(false);
  };

  const leagueEntries = Object.entries(leagues);

  return (
    <div className="w-full max-w-xl">
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-100">New Poll</h3>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Question */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prompt" className="text-xs font-medium text-gray-400">
              Question
            </label>
            <input
              id="prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask a question..."
              className="rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Choices */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">Choices</label>
            <div className="flex flex-col gap-1.5">
              {choices.map((choice, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => updateChoice(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  />
                  {choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeChoice(i)}
                      className="text-red-400 hover:text-red-300 px-1 text-sm"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addChoice}
              className="self-start text-xs text-blue-400 hover:text-blue-300"
            >
              + Add choice
            </button>
          </div>

          {/* Poll type & privacy */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Type</label>
              <select
                value={pollType}
                onChange={(e) =>
                  setPollType(e.target.value as "single" | "multiple")
                }
                className="rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="single">Single choice</option>
                <option value="multiple">Multiple choice</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Privacy</label>
              <select
                value={privacy}
                onChange={(e) =>
                  setPrivacy(e.target.value as "public" | "anonymous")
                }
                className="rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="public">Public</option>
                <option value="anonymous">Anonymous</option>
              </select>
            </div>
          </div>

          {/* League selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">
              Leagues{selectedLeagues.length > 0 && (
                <span className="text-gray-500 ml-1">({selectedLeagues.length})</span>
              )}
            </label>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-1.5">
              {leagueEntries.map(([id, league]) => (
                <label
                  key={id}
                  className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded text-sm transition ${
                    selectedLeagues.includes(id)
                      ? "bg-blue-600/10 text-gray-100"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLeagues.includes(id)}
                    onChange={() => toggleLeague(id)}
                    className="accent-blue-500"
                  />
                  {league.name}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Posting..." : "Create Poll"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PollsList({
  leagues,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
}) {
  const { groups, loading, error, refetch, removeGroup } = usePolls();

  if (loading) return <p className="text-gray-400 mt-4">Loading polls...</p>;
  if (error) return <p className="text-red-400 mt-4">{error}</p>;
  if (groups.length === 0)
    return <p className="text-gray-400 mt-4">No polls yet.</p>;

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">Your Polls</h2>
        <button
          onClick={refetch}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          Refresh
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <PollGroupCard
            key={group.group_id}
            group={group}
            leagues={leagues}
            onRemove={() => {
              if (window.confirm("Remove this poll from all leagues?")) {
                removeGroup(group.group_id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

type Voter = {
  user_id: string;
  name: string;
  avatar: string | null;
  count?: number; // >1 in aggregate when user is in multiple leagues
};

function VoteBar({
  choice,
  count,
  total,
  voters,
}: {
  choice: string;
  count: number;
  total: number;
  voters?: Voter[];
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="shrink-0 text-sm text-gray-300">
        {choice}
        <span className="ml-1.5 text-xs text-gray-500">
          {count} · {pct}%
        </span>
      </span>
      {voters && voters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {voters.map((v) => (
            <span
              key={v.user_id}
              className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400"
            >
              <Avatar hash={v.avatar} alt={v.name} size={14} />
              {v.name}
              {v.count && v.count > 1 && (
                <span className="text-gray-500">{v.count}x</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PollGroupCard({
  group,
  leagues,
  onRemove,
}: {
  group: PollGroup;
  leagues: { [league_id: string]: LeagueDetailed };
  onRemove: () => void;
}) {
  const aggTotal = group.aggregateVotes.length;
  const aggCounts: Record<string, number> = {};
  // Track voters per choice for aggregate, counting duplicates across leagues
  const aggVoterMap: Record<string, Map<string, { name: string; avatar: string | null; count: number }>> = {};
  for (const vote of group.aggregateVotes) {
    aggCounts[vote.choice_id] = (aggCounts[vote.choice_id] ?? 0) + 1;
    if (!aggVoterMap[vote.choice_id]) aggVoterMap[vote.choice_id] = new Map();
    const existing = aggVoterMap[vote.choice_id].get(vote.user_id);
    if (existing) {
      existing.count += 1;
    } else {
      aggVoterMap[vote.choice_id].set(vote.user_id, {
        name: vote.name,
        avatar: vote.avatar,
        count: 1,
      });
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">{group.prompt}</h3>
          <span className="text-xs text-gray-500">
            {group.poll_type} · {group.privacy}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-gray-600 hover:text-red-400 transition"
        >
          Remove
        </button>
      </div>

      {/* Aggregate */}
      {group.polls.length > 1 && (
        <div className="mb-3 rounded bg-gray-900/40 p-3">
          <p className="text-xs font-medium text-gray-400 mb-2">
            Aggregate · {group.polls.length} leagues · {aggTotal} vote{aggTotal !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-col gap-1">
            {group.choices.map((choice, i) => {
              const choiceId = String(i);
              const voterMap = aggVoterMap[choiceId];
              const voters: Voter[] = voterMap
                ? Array.from(voterMap.entries()).map(([user_id, v]) => ({
                    user_id,
                    ...v,
                  }))
                : [];
              return (
                <VoteBar
                  key={i}
                  choice={choice}
                  count={aggCounts[choiceId] ?? 0}
                  total={aggTotal}
                  voters={voters}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Per-league breakdown */}
      <div className={`flex flex-col gap-2.5 ${group.polls.length > 1 ? "border-t border-gray-700/50 pt-2.5" : ""}`}>
        {group.polls.map((poll) => {
          const leagueName = leagues[poll.league_id]?.name ?? poll.league_id;
          const order = poll.choices_order ?? [];
          const voteCounts: Record<string, number> = {};
          for (const vote of poll.votes) {
            voteCounts[vote.choice_id] =
              (voteCounts[vote.choice_id] ?? 0) + 1;
          }
          const totalVotes = poll.votes.length;
          return (
            <div key={poll.poll_id}>
              <p className="text-xs font-medium text-gray-400 mb-1">
                {leagueName}
                <span className="font-normal text-gray-500 ml-1">
                  · {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                </span>
              </p>
              <div className="flex flex-col gap-0.5">
                {poll.choices.map((choice, i) => {
                  const choiceId = order[i];
                  const count = choiceId ? (voteCounts[choiceId] ?? 0) : 0;
                  const voters: Voter[] = choiceId
                    ? poll.votes
                        .filter((v) => v.choice_id === choiceId)
                        .map((v) => ({
                          user_id: v.user_id,
                          name: v.name,
                          avatar: v.avatar,
                        }))
                    : [];
                  return (
                    <VoteBar
                      key={i}
                      choice={choice}
                      count={count}
                      total={totalVotes}
                      voters={voters}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
