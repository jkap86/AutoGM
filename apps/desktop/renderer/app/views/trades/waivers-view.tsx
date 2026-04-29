"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  PlayerShares,
} from "@autogm/shared";
import { PlayerCombobox } from "../../components/player-combobox";
import { Avatar } from "../../components/avatar";
import { useIpcMutation } from "../../../hooks/use-ipc-mutation";

type BidMode = "amount" | "percent";
type LeagueTypeFilter = "all" | "dynasty" | "keeper" | "redraft";
type SubmitResult = { status: "success" } | { status: "error"; message: string };

export default function WaiversView({
  leagues,
  allplayers,
  userId,
  ktc,
  playerShares,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [id: string]: Allplayer };
  userId: string;
  ktc: Record<string, number>;
  playerShares: PlayerShares;
}) {
  const [playerToAdd, setPlayerToAdd] = useState<string | null>(null);
  const [playerToDrop, setPlayerToDrop] = useState<string | null>(null);
  const [bidMode, setBidMode] = useState<BidMode>("amount");
  const [masterBid, setMasterBid] = useState<number>(0);
  const [bidOverrides, setBidOverrides] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitResults, setSubmitResults] = useState<Record<string, SubmitResult>>({});
  const [leagueTypeFilter, setLeagueTypeFilter] = useState<LeagueTypeFilter>("all");
  // Roster filters
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [mustNotHave, setMustNotHave] = useState<string[]>([]);

  const { mutate: submitWaiver } = useIpcMutation<"submitWaiverClaim">("waiver:submit");

  const allPlayerIds = useMemo(() => Object.keys(allplayers), [allplayers]);

  const ownedPlayers = useMemo(
    () =>
      Object.keys(playerShares).filter(
        (pid) => playerShares[pid].owned.length > 0,
      ),
    [playerShares],
  );

  const getEffectiveBid = useCallback(
    (leagueId: string): number => {
      if (bidOverrides[leagueId] != null) return bidOverrides[leagueId];
      if (bidMode === "percent") {
        const league = leagues[leagueId];
        const totalBudget = league?.settings.waiver_budget ?? 100;
        const used = league?.user_roster.waiver_budget_used ?? 0;
        const remaining = totalBudget - used;
        return Math.max(0, Math.round((masterBid / 100) * remaining));
      }
      return masterBid;
    },
    [bidOverrides, bidMode, masterBid, leagues],
  );

  const filteredLeagues = useMemo(() => {
    if (!playerToAdd) return [];
    return Object.values(leagues).filter((league) => {
      const userPlayers = league.user_roster.players;
      if (userPlayers.includes(playerToAdd)) return false;
      if (playerToDrop && !userPlayers.includes(playerToDrop)) return false;
      // League type filter
      if (leagueTypeFilter === "dynasty" && league.settings.type !== 2) return false;
      if (leagueTypeFilter === "keeper" && league.settings.type !== 1) return false;
      if (leagueTypeFilter === "redraft" && league.settings.type !== 0) return false;
      // Roster filters
      if (mustHave.length > 0 && !mustHave.every((pid) => userPlayers.includes(pid))) return false;
      if (mustNotHave.length > 0 && !mustNotHave.every((pid) => !userPlayers.includes(pid))) return false;
      return true;
    });
  }, [leagues, playerToAdd, playerToDrop, leagueTypeFilter, mustHave, mustNotHave]);

  const getLeagueType = (league: LeagueDetailed): string => {
    const t = league.settings.type;
    return t === 2 ? "Dynasty" : t === 1 ? "Keeper" : "Redraft";
  };

  const handleSubmitAll = useCallback(async () => {
    if (!playerToAdd || filteredLeagues.length === 0) return;
    setSubmitting(true);
    setSubmitProgress(0);
    setSubmitResults({});

    const results: Record<string, SubmitResult> = {};
    for (let i = 0; i < filteredLeagues.length; i++) {
      const league = filteredLeagues[i];
      const rosterId = league.user_roster.roster_id;
      const bidAmount = getEffectiveBid(league.league_id);
      try {
        await submitWaiver({
          league_id: league.league_id,
          k_adds: [playerToAdd],
          v_adds: [rosterId],
          k_drops: playerToDrop ? [playerToDrop] : [],
          v_drops: playerToDrop ? [rosterId] : [],
          k_settings: ["waiver_bid"],
          v_settings: [bidAmount],
        });
        results[league.league_id] = { status: "success" };
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        results[league.league_id] = { status: "error", message: errMsg };
      }
      setSubmitProgress(i + 1);
      setSubmitResults({ ...results });
      if (i < filteredLeagues.length - 1) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
      }
    }
    setSubmitting(false);
  }, [playerToAdd, playerToDrop, filteredLeagues, getEffectiveBid, submitWaiver]);

  const addPlayer = allplayers[playerToAdd ?? ""];
  const dropPlayer = allplayers[playerToDrop ?? ""];
  const addKtc = playerToAdd ? (ktc[playerToAdd] ?? 0) : 0;
  const dropKtc = playerToDrop ? (ktc[playerToDrop] ?? 0) : 0;
  const netKtc = addKtc - dropKtc;

  const successCount = Object.values(submitResults).filter((r) => r.status === "success").length;
  const errorEntries = Object.entries(submitResults).filter(([, r]) => r.status === "error") as [string, { status: "error"; message: string }][];
  const errorCount = errorEntries.length;

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {/* Player Selection */}
      <div className="w-full max-w-3xl rounded-xl border border-gray-700/80 bg-gray-800 overflow-hidden">
        <div className="flex">
          {/* Pick Up side */}
          <div className="flex-1 p-4 border-r border-gray-700/40">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3 flex items-center gap-1.5">
              <span className="w-1 h-4 bg-green-500 rounded-full" />
              Pick Up
            </h3>
            <PlayerCombobox
              id="waiver-add"
              playerIds={allPlayerIds}
              allplayers={allplayers}
              selected={[playerToAdd, playerToDrop, ...mustHave, ...mustNotHave].filter(Boolean) as string[]}
              onSelect={(pid) => { setPlayerToAdd(pid); setSubmitResults({}); }}
              placeholder="Search players..."
            />
            {addPlayer && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-green-900/20 border border-green-800/40 px-3 py-2">
                <span className="text-xs font-bold text-green-600/80">{addPlayer.position}</span>
                <span className="text-sm text-green-300 font-medium">{addPlayer.full_name}</span>
                <span className="text-xs text-green-500/70">{addPlayer.team ?? "FA"}</span>
                {addKtc > 0 && (
                  <span className="ml-auto text-xs text-green-400/70">{addKtc.toLocaleString()}</span>
                )}
                <button onClick={() => { setPlayerToAdd(null); setSubmitResults({}); }} className="text-green-500 hover:text-green-300 ml-1">&times;</button>
              </div>
            )}
          </div>

          {/* Drop side */}
          <div className="flex-1 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
              <span className="w-1 h-4 bg-red-500 rounded-full" />
              Drop
              <span className="text-gray-600 text-[10px] font-normal normal-case tracking-normal">(optional)</span>
            </h3>
            <PlayerCombobox
              id="waiver-drop"
              playerIds={ownedPlayers}
              allplayers={allplayers}
              selected={[playerToAdd, playerToDrop, ...mustHave, ...mustNotHave].filter(Boolean) as string[]}
              onSelect={(pid) => { setPlayerToDrop(pid); setSubmitResults({}); }}
              placeholder="Search your players..."
            />
            {dropPlayer && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-900/20 border border-red-800/40 px-3 py-2">
                <span className="text-xs font-bold text-red-600/80">{dropPlayer.position}</span>
                <span className="text-sm text-red-300 font-medium">{dropPlayer.full_name}</span>
                <span className="text-xs text-red-500/70">{dropPlayer.team ?? "FA"}</span>
                {dropKtc > 0 && (
                  <span className="ml-auto text-xs text-red-400/70">{dropKtc.toLocaleString()}</span>
                )}
                <button onClick={() => { setPlayerToDrop(null); setSubmitResults({}); }} className="text-red-500 hover:text-red-300 ml-1">&times;</button>
              </div>
            )}
          </div>
        </div>

        {/* Net value indicator */}
        {playerToAdd && (addKtc > 0 || dropKtc > 0) && (
          <div className="flex items-center justify-center gap-3 border-t border-gray-700/40 px-5 py-1.5 bg-gray-900/30">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">KTC Net</span>
            <span className={`text-sm font-bold tabular-nums ${netKtc >= 0 ? "text-green-400" : "text-red-400"}`}>
              {netKtc >= 0 ? "+" : ""}{netKtc.toLocaleString()}
            </span>
            {addKtc > 0 && <span className="text-[10px] text-gray-600">({addKtc.toLocaleString()}{dropKtc > 0 ? ` − ${dropKtc.toLocaleString()}` : ""})</span>}
          </div>
        )}

        {/* Bid controls */}
        {playerToAdd && (
          <div className="flex items-center gap-4 border-t border-gray-700/40 px-5 py-2.5 bg-gray-800/50">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold shrink-0">Bid</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-gray-900/50 p-0.5">
              {([
                { key: "amount" as BidMode, label: "$ Amount" },
                { key: "percent" as BidMode, label: "% Remaining" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setBidMode(key)}
                  className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
                    bidMode === key
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0}
              value={masterBid}
              onChange={(e) => setMasterBid(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-sm text-gray-100 text-center focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-gray-500">
              {bidMode === "percent" ? `${masterBid}% of remaining` : `$${masterBid}`}
            </span>
          </div>
        )}
      </div>

      {/* Filters + League Cards */}
      {playerToAdd && (
        <div className="w-full max-w-3xl">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {/* League type filter */}
            <div className="flex items-center gap-0.5 rounded-lg bg-gray-800 p-0.5 border border-gray-700/60">
              {([
                { key: "all" as LeagueTypeFilter, label: "All" },
                { key: "dynasty" as LeagueTypeFilter, label: "Dynasty" },
                { key: "keeper" as LeagueTypeFilter, label: "Keeper" },
                { key: "redraft" as LeagueTypeFilter, label: "Redraft" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setLeagueTypeFilter(key)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    leagueTypeFilter === key
                      ? "bg-blue-600 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Roster filters */}
            <div className="flex items-center gap-1.5">
              <RosterFilterCombobox
                label="Has"
                color="blue"
                playerIds={allPlayerIds}
                allplayers={allplayers}
                selected={mustHave}
                excluded={[playerToAdd, playerToDrop, ...mustNotHave].filter(Boolean) as string[]}
                onAdd={(pid) => setMustHave((p) => [...p, pid])}
                onRemove={(pid) => setMustHave((p) => p.filter((x) => x !== pid))}
              />
              <RosterFilterCombobox
                label="Lacks"
                color="orange"
                playerIds={allPlayerIds}
                allplayers={allplayers}
                selected={mustNotHave}
                excluded={[playerToAdd, playerToDrop, ...mustHave].filter(Boolean) as string[]}
                onAdd={(pid) => setMustNotHave((p) => [...p, pid])}
                onRemove={(pid) => setMustNotHave((p) => p.filter((x) => x !== pid))}
              />
            </div>

            <span className="text-[10px] text-gray-500 ml-auto">
              {filteredLeagues.length} of {Object.keys(leagues).length} leagues
            </span>
          </div>

          {/* Submit bar */}
          <div className="flex flex-col gap-2 mb-3">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <span className="text-xs text-green-400 font-medium">{successCount} submitted</span>
              )}
              {errorCount > 0 && (
                <span className="text-xs text-red-400 font-medium">{errorCount} failed</span>
              )}
            </div>
            <button
              onClick={handleSubmitAll}
              disabled={submitting || filteredLeagues.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 shadow-sm shadow-blue-600/20"
            >
              {submitting
                ? `Submitting ${submitProgress}/${filteredLeagues.length}...`
                : `Submit to ${filteredLeagues.length} ${filteredLeagues.length === 1 ? "League" : "Leagues"}`}
            </button>
           </div>
           {/* Error details */}
           {errorEntries.length > 0 && !submitting && (
             <div className="rounded-lg border border-red-800/50 bg-red-900/15 px-3 py-2">
               <p className="text-[11px] font-semibold text-red-400 mb-1">
                 Submitted {successCount} of {successCount + errorCount}. Failed:
               </p>
               <ul className="flex flex-col gap-0.5">
                 {errorEntries.map(([lid, r]) => (
                   <li key={lid} className="text-[11px] text-red-300/80">
                     <span className="font-medium text-red-300">{leagues[lid]?.name ?? lid}</span>
                     {": "}
                     <span className="text-red-400/70">{r.message}</span>
                   </li>
                 ))}
               </ul>
             </div>
           )}
          </div>

          {filteredLeagues.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">No eligible leagues for this claim.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredLeagues.map((league) => {
                const totalBudget = league.settings.waiver_budget ?? 100;
                const used = league.user_roster.waiver_budget_used ?? 0;
                const remaining = totalBudget - used;
                const remainingPct = totalBudget > 0 ? (remaining / totalBudget) * 100 : 0;
                const effectiveBid = getEffectiveBid(league.league_id);
                const result = submitResults[league.league_id];
                const status = result?.status;

                return (
                  <div
                    key={league.league_id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      status === "success"
                        ? "border-green-700/60 bg-green-900/10"
                        : status === "error"
                        ? "border-red-700/60 bg-red-900/10"
                        : "border-gray-700/80 bg-gray-800"
                    }`}
                  >
                    <Avatar hash={league.avatar} alt={league.name} size={24} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-200 truncate">{league.name}</span>
                      <span className="text-[10px] text-gray-500">{getLeagueType(league)} · {league.rosters.length} teams</span>
                    </div>

                    {/* Budget bar — shows remaining */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(remainingPct, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 tabular-nums w-16 text-right">${remaining} left</span>
                    </div>

                    {/* Per-league bid override */}
                    <input
                      type="number"
                      min={0}
                      max={remaining || undefined}
                      placeholder={String(effectiveBid)}
                      value={bidOverrides[league.league_id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBidOverrides((prev) => {
                          if (val === "") {
                            const { [league.league_id]: _, ...rest } = prev;
                            return rest;
                          }
                          return { ...prev, [league.league_id]: Math.max(0, parseInt(val) || 0) };
                        });
                      }}
                      className="w-14 rounded-md border border-gray-700 bg-gray-900 px-1.5 py-1 text-xs text-gray-100 text-center focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
                    />

                    {/* Status indicator */}
                    {status === "success" && <span className="text-green-400 text-xs shrink-0">✓</span>}
                    {status === "error" && <span className="text-red-400 text-xs shrink-0">✗</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!playerToAdd && (
        <div className="flex flex-col items-center py-12 gap-3">
          <p className="text-gray-500 text-sm">Select a player to pick up to see eligible leagues.</p>
        </div>
      )}
    </div>
  );
}

/** Compact inline roster filter with combobox dropdown */
function RosterFilterCombobox({
  label,
  color,
  playerIds,
  allplayers,
  selected,
  excluded,
  onAdd,
  onRemove,
}: {
  label: string;
  color: "blue" | "orange";
  playerIds: string[];
  allplayers: { [id: string]: Allplayer };
  selected: string[];
  excluded: string[];
  onAdd: (pid: string) => void;
  onRemove: (pid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return playerIds
      .filter((id) => !selected.includes(id) && !excluded.includes(id))
      .filter((id) => (allplayers[id]?.full_name || "").toLowerCase().includes(q))
      .slice(0, 15);
  }, [query, playerIds, allplayers, selected, excluded]);

  const chipBg = color === "blue" ? "bg-blue-500/15" : "bg-orange-500/15";
  const chipText = color === "blue" ? "text-blue-400" : "text-orange-400";
  const chipClose = color === "blue" ? "text-blue-500 hover:text-blue-300" : "text-orange-500 hover:text-orange-300";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={`rounded-md border border-gray-700/60 bg-gray-800 px-2.5 py-1 text-[11px] font-medium transition ${
          selected.length > 0
            ? `${color === "blue" ? "border-blue-500/40" : "border-orange-500/40"} ${chipText}`
            : "text-gray-500 hover:text-gray-300"
        }`}
      >
        {label}{selected.length > 0 ? ` (${selected.length})` : ""}
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((pid) => (
            <span key={pid} className={`inline-flex items-center gap-1 rounded-full ${chipBg} px-2 py-0.5 text-[10px] ${chipText}`}>
              {allplayers[pid]?.full_name || pid}
              <button onClick={() => onRemove(pid)} className={chipClose}>&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-20 overflow-hidden">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
            className="w-full border-b border-gray-700/60 bg-transparent px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none"
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 && query.trim() && (
              <span className="block px-3 py-2 text-xs text-gray-500">No results</span>
            )}
            {filtered.map((pid) => {
              const p = allplayers[pid];
              return (
                <button
                  key={pid}
                  onClick={() => { onAdd(pid); setQuery(""); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-gray-800 transition"
                >
                  <span className="text-[10px] font-semibold text-gray-500 w-5">{p?.position ?? "?"}</span>
                  <span className="text-xs text-gray-200 truncate">{p?.full_name || pid}</span>
                  <span className="text-[10px] text-gray-600 ml-auto">{p?.team ?? "FA"}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => { setOpen(false); setQuery(""); }} className="w-full border-t border-gray-700/60 px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
