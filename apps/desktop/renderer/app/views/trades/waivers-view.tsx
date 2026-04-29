"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  PlayerShares,
} from "@autogm/shared";
import { PlayerCombobox } from "../../components/player-combobox";
import { Avatar } from "../../components/avatar";
import { useGraphqlMutation } from "../../../hooks/use-ipc-mutation";

type BidMode = "amount" | "percent";

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

  const { mutate: submitWaiver } = useGraphqlMutation("submitWaiverClaim");

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
      return true;
    });
  }, [leagues, playerToAdd, playerToDrop]);

  const getLeagueType = (league: LeagueDetailed): string => {
    const t = league.settings.type;
    return t === 2 ? "Dynasty" : t === 1 ? "Keeper" : "Redraft";
  };

  const handleSubmitAll = useCallback(async () => {
    if (!playerToAdd || filteredLeagues.length === 0) return;
    setSubmitting(true);
    setSubmitProgress(0);

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
      } catch (e) {
        console.error(`Waiver claim failed for ${league.name}:`, e);
      }
      setSubmitProgress(i + 1);
      if (i < filteredLeagues.length - 1) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
      }
    }
    setSubmitting(false);
  }, [playerToAdd, playerToDrop, filteredLeagues, getEffectiveBid, submitWaiver]);

  const addPlayer = allplayers[playerToAdd ?? ""];
  const dropPlayer = allplayers[playerToDrop ?? ""];

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {/* Player Selection — styled like trade builder give/receive */}
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
              selected={[playerToAdd, playerToDrop].filter(Boolean) as string[]}
              onSelect={(pid) => setPlayerToAdd(pid)}
              placeholder="Search players..."
            />
            {addPlayer && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-green-900/20 border border-green-800/40 px-3 py-2">
                <span className="text-xs font-bold text-green-600/80">{addPlayer.position}</span>
                <span className="text-sm text-green-300 font-medium">{addPlayer.full_name}</span>
                <span className="text-xs text-green-500/70">{addPlayer.team ?? "FA"}</span>
                {ktc[playerToAdd!] > 0 && (
                  <span className="ml-auto text-xs text-green-400/70">{ktc[playerToAdd!]}</span>
                )}
                <button onClick={() => setPlayerToAdd(null)} className="text-green-500 hover:text-green-300 ml-1">&times;</button>
              </div>
            )}
          </div>

          {/* Drop side */}
          <div className="flex-1 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
              <span className="w-1 h-4 bg-red-500 rounded-full" />
              Drop
            </h3>
            <PlayerCombobox
              id="waiver-drop"
              playerIds={ownedPlayers}
              allplayers={allplayers}
              selected={[playerToAdd, playerToDrop].filter(Boolean) as string[]}
              onSelect={(pid) => setPlayerToDrop(pid)}
              placeholder="Search your players..."
            />
            {dropPlayer && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-900/20 border border-red-800/40 px-3 py-2">
                <span className="text-xs font-bold text-red-600/80">{dropPlayer.position}</span>
                <span className="text-sm text-red-300 font-medium">{dropPlayer.full_name}</span>
                <span className="text-xs text-red-500/70">{dropPlayer.team ?? "FA"}</span>
                {ktc[playerToDrop!] > 0 && (
                  <span className="ml-auto text-xs text-red-400/70">{ktc[playerToDrop!]}</span>
                )}
                <button onClick={() => setPlayerToDrop(null)} className="text-red-500 hover:text-red-300 ml-1">&times;</button>
              </div>
            )}
          </div>
        </div>

        {/* Bid controls — inline bar at bottom of selection card */}
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

      {/* Eligible Leagues + Submit */}
      {playerToAdd && filteredLeagues.length > 0 && (
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {filteredLeagues.length} eligible {filteredLeagues.length === 1 ? "league" : "leagues"}
            </span>
            <button
              onClick={handleSubmitAll}
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 shadow-sm shadow-blue-600/20"
            >
              {submitting
                ? `Submitting ${submitProgress}/${filteredLeagues.length}...`
                : `Submit to ${filteredLeagues.length} ${filteredLeagues.length === 1 ? "League" : "Leagues"}`}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {filteredLeagues.map((league) => {
              const totalBudget = league.settings.waiver_budget ?? 100;
              const used = league.user_roster.waiver_budget_used ?? 0;
              const remaining = totalBudget - used;
              const usedPct = totalBudget > 0 ? (used / totalBudget) * 100 : 0;
              const effectiveBid = getEffectiveBid(league.league_id);

              return (
                <div
                  key={league.league_id}
                  className="flex items-center gap-3 rounded-xl border border-gray-700/80 bg-gray-800 px-4 py-3"
                >
                  <Avatar hash={league.avatar} alt={league.name} size={24} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-200 truncate">{league.name}</span>
                    <span className="text-[10px] text-gray-500">{getLeagueType(league)} · {league.rosters.length} teams</span>
                  </div>

                  {/* Budget bar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(usedPct, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 tabular-nums w-16 text-right">{remaining}/{totalBudget}</span>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {playerToAdd && filteredLeagues.length === 0 && (
        <p className="text-gray-500 text-sm py-6">No eligible leagues for this claim.</p>
      )}

      {!playerToAdd && (
        <div className="flex flex-col items-center py-12 gap-3">
          <p className="text-gray-500 text-sm">Select a player to pick up to see eligible leagues.</p>
        </div>
      )}
    </div>
  );
}
