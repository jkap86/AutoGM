"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [pendingClaims, setPendingClaims] = useState<
    Record<string, { transaction_id: string; adds: Record<string, number> | null; drops: Record<string, number> | null; settings: Record<string, unknown> | null; league_id: string }[]>
  >({});

  const { mutate: submitWaiver } = useGraphqlMutation("submitWaiverClaim");
  const { mutate: cancelWaiver } = useGraphqlMutation("cancelWaiverClaim");
  const { mutate: fetchTransactions } = useGraphqlMutation("leagueTransactions");

  const allPlayerIds = useMemo(() => Object.keys(allplayers), [allplayers]);

  const ownedPlayers = useMemo(
    () =>
      Object.keys(playerShares).filter(
        (pid) => playerShares[pid].owned.length > 0,
      ),
    [playerShares],
  );

  // Resolve the effective bid for a league
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

  // Filter leagues: user doesn't own the "add" player, and (if drop specified) user owns the "drop" player
  const filteredLeagues = useMemo(() => {
    if (!playerToAdd) return [];
    return Object.values(leagues).filter((league) => {
      const userPlayers = league.user_roster.players;
      // User must NOT already own the player to add
      if (userPlayers.includes(playerToAdd)) return false;
      // If a drop is specified, user must own that player
      if (playerToDrop && !userPlayers.includes(playerToDrop)) return false;
      return true;
    });
  }, [leagues, playerToAdd, playerToDrop]);

  // Fetch pending claims for visible leagues
  useEffect(() => {
    if (filteredLeagues.length === 0) return;
    let cancelled = false;
    (async () => {
      const results: typeof pendingClaims = {};
      for (const league of filteredLeagues) {
        try {
          const res = await fetchTransactions({
            league_id: league.league_id,
            type: "waiver",
            status: "proposed",
            roster_id: league.user_roster.roster_id,
          });
          if (cancelled) return;
          const txns = res.league_transactions ?? [];
          if (txns.length > 0) {
            results[league.league_id] = txns.map((t) => ({
              transaction_id: t.transaction_id,
              adds: t.adds,
              drops: t.drops,
              settings: t.metadata,
              league_id: t.league_id,
            }));
          }
        } catch {
          // ignore fetch errors for individual leagues
        }
      }
      if (!cancelled) setPendingClaims(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredLeagues.map((l) => l.league_id).join(",")]);

  const getLeagueType = (league: LeagueDetailed): string => {
    const t = league.settings.type;
    return t === 2 ? "Dynasty" : t === 1 ? "Keeper" : "Redraft";
  };

  const handleSubmit = useCallback(
    async (leagueId: string) => {
      if (!playerToAdd) return;
      const league = leagues[leagueId];
      if (!league) return;
      const rosterId = league.user_roster.roster_id;
      const bidAmount = getEffectiveBid(leagueId);

      setSubmitting(leagueId);
      try {
        await submitWaiver({
          league_id: leagueId,
          k_adds: [playerToAdd],
          v_adds: [rosterId],
          k_drops: playerToDrop ? [playerToDrop] : [],
          v_drops: playerToDrop ? [rosterId] : [],
          k_settings: ["waiver_bid"],
          v_settings: [bidAmount],
        });
        // Refresh pending claims for this league
        try {
          const res = await fetchTransactions({
            league_id: leagueId,
            type: "waiver",
            status: "proposed",
            roster_id: rosterId,
          });
          setPendingClaims((prev) => ({
            ...prev,
            [leagueId]: (res.league_transactions ?? []).map((t) => ({
              transaction_id: t.transaction_id,
              adds: t.adds,
              drops: t.drops,
              settings: t.metadata,
              league_id: t.league_id,
            })),
          }));
        } catch {
          // ignore refresh error
        }
      } catch (e) {
        console.error("Waiver claim failed:", e);
      } finally {
        setSubmitting(null);
      }
    },
    [playerToAdd, playerToDrop, leagues, getEffectiveBid, submitWaiver, fetchTransactions],
  );

  const handleBatchSubmit = useCallback(async () => {
    if (selectedLeagues.size === 0 || !playerToAdd) return;
    setBatchSubmitting(true);
    for (const leagueId of selectedLeagues) {
      await handleSubmit(leagueId);
      // Small delay between submissions
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
    }
    setSelectedLeagues(new Set());
    setBatchSubmitting(false);
  }, [selectedLeagues, playerToAdd, handleSubmit]);

  const handleCancel = useCallback(
    async (leagueId: string, transactionId: string) => {
      try {
        await cancelWaiver({ league_id: leagueId, transaction_id: transactionId });
        setPendingClaims((prev) => {
          const updated = { ...prev };
          updated[leagueId] = (updated[leagueId] ?? []).filter(
            (c) => c.transaction_id !== transactionId,
          );
          if (updated[leagueId].length === 0) delete updated[leagueId];
          return updated;
        });
      } catch (e) {
        console.error("Cancel waiver failed:", e);
      }
    },
    [cancelWaiver],
  );

  const toggleLeague = (leagueId: string) => {
    setSelectedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedLeagues(new Set(filteredLeagues.map((l) => l.league_id)));
  };

  const deselectAll = () => {
    setSelectedLeagues(new Set());
  };

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {/* Player Selection */}
      <div className="w-full max-w-3xl rounded-xl border border-gray-700/80 bg-gray-800 p-5">
        <h2 className="text-lg font-bold text-gray-100 mb-4">Waiver Claim</h2>
        <div className="flex gap-4">
          {/* Pick Up */}
          <div className="flex-1 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-green-400">
              Pick Up
            </h3>
            <PlayerCombobox
              id="waiver-add"
              playerIds={allPlayerIds}
              allplayers={allplayers}
              selected={[playerToAdd, playerToDrop].filter(Boolean) as string[]}
              onSelect={(pid) => setPlayerToAdd(pid)}
              placeholder="Search all players..."
            />
            {playerToAdd && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-1 text-xs text-green-300">
                  {allplayers[playerToAdd]?.full_name || playerToAdd}
                  {allplayers[playerToAdd]?.position && (
                    <span className="text-green-400/60 text-[10px] font-bold">
                      {allplayers[playerToAdd].position}
                    </span>
                  )}
                  {ktc[playerToAdd] > 0 && (
                    <span className="text-green-400/70 text-xs">{ktc[playerToAdd]}</span>
                  )}
                  <button
                    onClick={() => setPlayerToAdd(null)}
                    className="text-green-400 hover:text-green-300 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Drop */}
          <div className="flex-1 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400">
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
            {playerToDrop && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-1 text-xs text-red-300">
                  {allplayers[playerToDrop]?.full_name || playerToDrop}
                  {allplayers[playerToDrop]?.position && (
                    <span className="text-red-400/60 text-[10px] font-bold">
                      {allplayers[playerToDrop].position}
                    </span>
                  )}
                  {ktc[playerToDrop] > 0 && (
                    <span className="text-red-400/70 text-xs">{ktc[playerToDrop]}</span>
                  )}
                  <button
                    onClick={() => setPlayerToDrop(null)}
                    className="text-red-400 hover:text-red-300 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master Bid Controls */}
      {playerToAdd && (
        <div className="w-full max-w-3xl flex items-center gap-4 rounded-xl border border-gray-700/60 bg-gray-800/50 px-5 py-3">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold shrink-0">
            Bid
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-900/50 p-0.5">
            {(
              [
                { key: "amount" as BidMode, label: "$ Amount" },
                { key: "percent" as BidMode, label: "% of Remaining" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setBidMode(key)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
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
            className="w-20 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-gray-100 text-center focus:border-blue-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">
            {bidMode === "percent"
              ? `${masterBid}% of remaining FAAB`
              : `$${masterBid} FAAB`}
          </span>
        </div>
      )}

      {/* League Cards */}
      {playerToAdd && (
        <div className="w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-gray-100">Eligible Leagues</h2>
              <span className="text-sm text-gray-500">
                {filteredLeagues.length} {filteredLeagues.length === 1 ? "league" : "leagues"}
                {selectedLeagues.size > 0 && ` \u00B7 ${selectedLeagues.size} selected`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filteredLeagues.length > 0 && (
                <>
                  <button
                    onClick={selectedLeagues.size === filteredLeagues.length ? deselectAll : selectAll}
                    className="rounded-md px-2.5 py-1 text-[11px] font-medium bg-gray-700/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition"
                  >
                    {selectedLeagues.size === filteredLeagues.length ? "Deselect All" : "Select All"}
                  </button>
                  {selectedLeagues.size > 0 && (
                    <button
                      onClick={handleBatchSubmit}
                      disabled={batchSubmitting}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {batchSubmitting
                        ? "Submitting..."
                        : `Submit All (${selectedLeagues.size})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {filteredLeagues.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">
              No eligible leagues found for this claim.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredLeagues.map((league) => {
                const totalBudget = league.settings.waiver_budget ?? 100;
                const used = league.user_roster.waiver_budget_used;
                const remaining = totalBudget - used;
                const usedPct = totalBudget > 0 ? (used / totalBudget) * 100 : 0;
                const effectiveBid = getEffectiveBid(league.league_id);
                const isSelected = selectedLeagues.has(league.league_id);
                const isSubmitting = submitting === league.league_id;
                const claims = pendingClaims[league.league_id] ?? [];

                return (
                  <div
                    key={league.league_id}
                    className="rounded-xl border border-gray-700/80 bg-gray-800 overflow-hidden"
                  >
                    {/* League header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLeague(league.league_id)}
                        className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                      />
                      <Avatar hash={league.avatar} alt={league.name} size={24} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {league.name}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                          {getLeagueType(league)}
                        </span>
                      </div>

                      {/* Budget bar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 h-2 rounded-full bg-gray-700 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(usedPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium tabular-nums whitespace-nowrap">
                          {used}/{totalBudget} FAAB
                        </span>
                      </div>
                    </div>

                    {/* Bid + submit row */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-700/40 bg-gray-800/50">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold shrink-0">
                        Bid
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={remaining}
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
                        className="w-16 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100 text-center focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
                      />
                      <span className="text-[10px] text-gray-500">
                        ${effectiveBid} of ${remaining} remaining
                      </span>
                      <button
                        onClick={() => handleSubmit(league.league_id)}
                        disabled={isSubmitting || batchSubmitting || effectiveBid > remaining}
                        className="ml-auto rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </button>
                    </div>

                    {/* Pending claims for this league */}
                    {claims.length > 0 && (
                      <div className="border-t border-gray-700/40 px-4 py-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                          Pending Claims
                        </span>
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          {claims.map((claim) => {
                            const addIds = Object.keys(claim.adds ?? {});
                            const dropIds = Object.keys(claim.drops ?? {});
                            const bidVal =
                              claim.settings && typeof claim.settings === "object"
                                ? (claim.settings as Record<string, unknown>).waiver_bid
                                : null;
                            return (
                              <div
                                key={claim.transaction_id}
                                className="flex items-center gap-2 rounded-md bg-gray-900/50 border border-gray-700/40 px-2.5 py-1.5"
                              >
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  {addIds.map((pid) => (
                                    <span key={pid} className="text-xs text-green-400 truncate">
                                      +{allplayers[pid]?.full_name || pid}
                                    </span>
                                  ))}
                                  {dropIds.map((pid) => (
                                    <span key={pid} className="text-xs text-red-400 truncate">
                                      -{allplayers[pid]?.full_name || pid}
                                    </span>
                                  ))}
                                </div>
                                {bidVal != null && (
                                  <span className="text-[10px] text-gray-400 font-medium tabular-nums shrink-0">
                                    ${String(bidVal)}
                                  </span>
                                )}
                                <button
                                  onClick={() =>
                                    handleCancel(league.league_id, claim.transaction_id)
                                  }
                                  className="text-red-400 hover:text-red-300 text-xs shrink-0 transition"
                                  title="Cancel claim"
                                >
                                  &times;
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!playerToAdd && (
        <div className="flex flex-col items-center py-12 gap-3">
          <p className="text-gray-500 text-sm">
            Select a player to pick up to see eligible leagues.
          </p>
        </div>
      )}
    </div>
  );
}
