import { useState } from "react";
import { LeagueDetailed } from "../../../main/lib/types";
import { useCreatePoll } from "../../hooks/use-create-poll";
import { usePolls, PollWithVotes } from "../../hooks/use-polls";

export default function PollsView({
  leagues,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col flex-1 items-center w-full">
      {showCreate ? (
        <CreatePolls leagues={leagues} setShowCreate={setShowCreate} />
      ) : (
        <button onClick={() => setShowCreate(true)}>Create Poll</button>
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
    for (const leagueId of selectedLeagues) {
      await createPoll({
        league_id: leagueId,
        prompt,
        choices: validChoices,
        k_metadata: ["poll_type", "privacy"],
        v_metadata: [pollType, privacy],
      });
    }
    setShowCreate(false);
  };

  const leagueEntries = Object.entries(leagues);

  return (
    <div className="w-full max-w-2xl p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Question */}
        <div className="flex flex-col gap-1">
          <label htmlFor="prompt" className="text-sm text-gray-400">
            Question
          </label>
          <input
            id="prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question..."
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
          />
        </div>

        {/* Choices */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Choices</label>
          <div className="flex flex-col gap-2">
            {choices.map((choice, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={choice}
                  onChange={(e) => updateChoice(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
                />
                {choices.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeChoice(i)}
                    className="text-red-400 hover:text-red-500 px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addChoice}
            className="mt-1 self-start text-sm text-blue-400 hover:text-blue-300"
          >
            + Add choice
          </button>
        </div>

        {/* Poll type */}
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Poll Type</label>
            <select
              value={pollType}
              onChange={(e) =>
                setPollType(e.target.value as "single" | "multiple")
              }
              className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            >
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Privacy</label>
            <select
              value={privacy}
              onChange={(e) =>
                setPrivacy(e.target.value as "public" | "anonymous")
              }
              className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100"
            >
              <option value="public">Public</option>
              <option value="anonymous">Anonymous</option>
            </select>
          </div>
        </div>

        {/* League selection */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">
            Post to leagues ({selectedLeagues.length} selected)
          </label>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-2">
            {leagueEntries.map(([id, league]) => (
              <label
                key={id}
                className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={selectedLeagues.includes(id)}
                  onChange={() => toggleLeague(id)}
                  className="accent-blue-500"
                />
                <span className="text-gray-100">{league.name}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Posting..." : "Create Poll"}
        </button>
      </form>
    </div>
  );
}

function PollsList({
  leagues,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
}) {
  const { polls, loading, error, refetch, remove } = usePolls();

  if (loading) return <p className="text-gray-400 mt-4">Loading polls...</p>;
  if (error) return <p className="text-red-400 mt-4">{error}</p>;
  if (polls.length === 0)
    return <p className="text-gray-400 mt-4">No polls yet.</p>;

  return (
    <div className="w-full max-w-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Your Polls</h2>
        <button
          onClick={refetch}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Refresh
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {polls.map((poll) => (
          <PollCard
            key={poll.poll_id}
            poll={poll}
            leagueName={leagues[poll.league_id]?.name ?? poll.league_id}
            onRemove={() => remove(poll.poll_id)}
          />
        ))}
      </div>
    </div>
  );
}

function PollCard({
  poll,
  leagueName,
  onRemove,
}: {
  poll: PollWithVotes;
  leagueName: string;
  onRemove: () => void;
}) {
  const totalVotes = poll.votes.length;

  const voteCounts: Record<string, number> = {};
  for (const vote of poll.votes) {
    voteCounts[vote.choice_id] = (voteCounts[vote.choice_id] ?? 0) + 1;
  }

  // choices_order maps index → choice_id (e.g. ["XFR5", "ABC1"])
  // choices maps index → choice text (e.g. ["yes", "no"])
  const order = poll.choices_order ?? [];

  return (
    <div className="rounded border border-gray-700 bg-gray-900 p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium text-gray-100">{poll.prompt}</h3>
          <span className="text-xs text-gray-500">{leagueName}</span>
        </div>
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-500 text-sm"
        >
          Remove
        </button>
      </div>
      <div className="flex flex-col gap-2 mt-3">
        {poll.choices.map((choice, i) => {
          const choiceId = order[i];
          const count = choiceId ? (voteCounts[choiceId] ?? 0) : 0;
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          return (
            <div key={i}>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>{choice}</span>
                <span>
                  {count} vote{count !== 1 ? "s" : ""} ({Math.round(pct)}%)
                </span>
              </div>
              <div className="h-2 rounded bg-gray-800">
                <div
                  className="h-2 rounded bg-blue-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        {totalVotes} total vote{totalVotes !== 1 ? "s" : ""} &middot;{" "}
        {poll.poll_type} &middot; {poll.privacy}
      </p>
    </div>
  );
}
