import { useEffect, useMemo, useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  Roster,
} from "@sleepier/shared";
import { Avatar } from "../../components/avatar";
import { formatRecord, formatTime } from "../../../lib/trade-utils";

type DraftPick = {
  player_id: string;
  pick_no: number;
  round: number;
  draft_slot: number;
  amount: number | null;
  draft_id: string;
  season: string;
  league_id: string;
  type: string;
  teams: number;
};

/** Compute the pick-within-round from overall pick_no. pick_no is always sequential
 *  (1, 2, 3...) regardless of draft type. Round and slot within the round are derived. */
function formatDraftPick(pick: DraftPick): string {
  const teams = Number(pick.teams);
  if (!teams || teams <= 0) return `#${pick.pick_no}`;
  const round = Math.ceil(pick.pick_no / teams);
  const slot = ((pick.pick_no - 1) % teams) + 1;
  return `${round}.${String(slot).padStart(2, "0")}`;
}

export function OpponentPanel({
  partner,
  league,
  allplayers,
  leagues,
  involvedPlayerIds = [],
}: {
  partner: Roster;
  league: LeagueDetailed;
  allplayers: { [id: string]: Allplayer };
  leagues: { [league_id: string]: LeagueDetailed };
  involvedPlayerIds?: string[];
}) {
  const [tab, setTab] = useState<"roster" | "trades" | "drafts">("roster");

  return (
    <div className="flex flex-col">
      {/* Opponent header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-700/40">
        <Avatar hash={partner.avatar} alt={partner.username} size={32} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-gray-100 truncate" title={partner.username}>
            {partner.username}
          </span>
          <span className="text-[10px] text-gray-500">
            {formatRecord(partner)} · {league.name}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-700/40 px-4">
        {([
          { key: "roster" as const, label: "Player Shares" },
          { key: "trades" as const, label: "Recent Trades" },
          { key: "drafts" as const, label: "Draft History" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? "text-gray-100 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-3 max-h-80 overflow-y-auto">
        {tab === "roster" && (
          <PlayerSharesSection
            partner={partner}
            allplayers={allplayers}
            leagues={leagues}
          />
        )}
        {tab === "trades" && (
          <RecentTradesSection
            partnerId={partner.user_id}
            allplayers={allplayers}
            involvedPlayerIds={involvedPlayerIds}
          />
        )}
        {tab === "drafts" && (
          <DraftHistorySection
            partnerId={partner.user_id}
            allplayers={allplayers}
          />
        )}
      </div>
    </div>
  );
}

// ---- Player Shares: which players the opponent owns and in how many leagues ----

function PlayerSharesSection({
  partner,
  allplayers,
  leagues,
}: {
  partner: Roster;
  allplayers: { [id: string]: Allplayer };
  leagues: { [league_id: string]: LeagueDetailed };
}) {
  const shares = useMemo(() => {
    // Count how many leagues the opponent rosters each player
    const counts: Record<string, { count: number; leagueNames: string[] }> = {};
    for (const lg of Object.values(leagues)) {
      const opponentRoster = lg.rosters.find((r) => r.user_id === partner.user_id);
      if (!opponentRoster) continue;
      for (const pid of opponentRoster.players ?? []) {
        if (!counts[pid]) counts[pid] = { count: 0, leagueNames: [] };
        counts[pid].count++;
        counts[pid].leagueNames.push(lg.name);
      }
    }

    return Object.entries(counts)
      .map(([player_id, { count, leagueNames }]) => {
        const p = allplayers[player_id];
        return {
          player_id,
          name: p?.full_name ?? player_id,
          position: p?.position ?? "?",
          team: p?.team ?? "",
          count,
          leagueNames,
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [partner.user_id, allplayers, leagues]);

  if (shares.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No shared leagues with this opponent</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] text-gray-500 mb-1">
        {shares.length} players across {new Set(shares.flatMap((s) => s.leagueNames)).size} leagues
      </p>
      {shares.map((s) => (
        <div key={s.player_id} className="flex items-center gap-1.5 py-0.5 text-xs">
          <span className="w-6 shrink-0 text-center font-semibold text-gray-500">{s.position}</span>
          <span className="text-gray-200 truncate min-w-0" title={s.name}>{s.name}</span>
          {s.team && <span className="shrink-0 text-gray-600 text-[10px]">{s.team}</span>}
          <span
            className="ml-auto shrink-0 text-[10px] text-gray-500 cursor-help"
            title={s.leagueNames.join(", ")}
          >
            {s.count} lg{s.count !== 1 ? "s" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Recent Trades in this league ----

type TradeTransaction = {
  transaction_id: string;
  status_updated: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: string[] | null;
};

function RecentTradesSection({
  partnerId,
  allplayers,
  involvedPlayerIds,
}: {
  partnerId: string;
  allplayers: { [id: string]: Allplayer };
  involvedPlayerIds: string[];
}) {
  const [trades, setTrades] = useState<(TradeTransaction & { league_name: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const playerKey = useMemo(() => [...involvedPlayerIds].sort().join(","), [involvedPlayerIds]);

  useEffect(() => {
    if (involvedPlayerIds.length === 0) {
      setTrades([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.ipc
      .invoke<(TradeTransaction & { league_name: string })[]>("opponent:trades", {
        opponentUserId: partnerId,
        playerIds: involvedPlayerIds,
      })
      .then((r) => {
        if (!cancelled) setTrades(r);
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, playerKey]);

  if (loading) {
    return <p className="text-xs text-gray-500 text-center py-4">Loading trades...</p>;
  }

  if (involvedPlayerIds.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No players selected to search trades for</p>;
  }

  if (trades.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No trades involving these players in this league</p>;
  }

  const involvedSet = new Set(involvedPlayerIds);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-gray-500 mb-1">
        {trades.length} trade{trades.length !== 1 ? "s" : ""} involving selected players across {new Set(trades.map((t) => t.league_name)).size} league{new Set(trades.map((t) => t.league_name)).size !== 1 ? "s" : ""}
      </p>
      {trades.map((tx) => {
        const rosterIds = tx.roster_ids;
        return (
          <div key={tx.transaction_id} className="rounded bg-gray-900/40 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{formatTime(tx.status_updated)}</span>
              <span className="text-[10px] text-gray-600 truncate" title={tx.league_name}>{tx.league_name}</span>
            </div>
            <div className="flex gap-4 mt-1">
              {rosterIds.map((rid) => {
                const got = Object.entries(tx.adds ?? {})
                  .filter(([, r]) => r === rid)
                  .map(([pid]) => ({ pid, name: allplayers[pid]?.full_name ?? pid, involved: involvedSet.has(pid) }));
                const gave = Object.entries(tx.drops ?? {})
                  .filter(([, r]) => r === rid)
                  .map(([pid]) => ({ pid, name: allplayers[pid]?.full_name ?? pid, involved: involvedSet.has(pid) }));
                if (got.length === 0 && gave.length === 0) return null;
                return (
                  <div key={rid} className="min-w-0">
                    <span className="text-[10px] font-semibold text-gray-400">Roster {rid}</span>
                    {got.map((p, i) => (
                      <div key={`g${i}`} className={`text-[11px] ${p.involved ? "text-green-300 font-medium" : "text-green-400/60"}`}>
                        + {p.name}
                      </div>
                    ))}
                    {gave.map((p, i) => (
                      <div key={`s${i}`} className={`text-[11px] ${p.involved ? "text-red-300 font-medium" : "text-red-400/60"}`}>
                        - {p.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Draft History: actual picks they've made from Postgres ----

function DraftHistorySection({
  partnerId,
  allplayers,
}: {
  partnerId: string;
  allplayers: { [id: string]: Allplayer };
}) {
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.ipc
      .invoke<DraftPick[]>("opponent:drafts", { userId: partnerId })
      .then((r) => {
        if (!cancelled) setPicks(r);
      })
      .catch(() => {
        if (!cancelled) setPicks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [partnerId]);

  const grouped = useMemo(() => {
    const byDraft: Record<string, { season: string; type: string; picks: DraftPick[] }> = {};
    for (const p of picks) {
      if (!byDraft[p.draft_id]) byDraft[p.draft_id] = { season: p.season, type: p.type, picks: [] };
      byDraft[p.draft_id].picks.push(p);
    }
    return Object.entries(byDraft)
      .sort(([, a], [, b]) => b.season.localeCompare(a.season))
      .map(([draft_id, data]) => ({
        draft_id,
        ...data,
        picks: data.picks.sort((a, b) => a.pick_no - b.pick_no),
      }));
  }, [picks]);

  if (loading) {
    return <p className="text-xs text-gray-500 text-center py-4">Loading draft history...</p>;
  }

  if (grouped.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No draft history found</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map((draft) => (
        <div key={draft.draft_id}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              {draft.season} {draft.type}
            </span>
            <span className="text-[10px] text-gray-600">{draft.picks.length} picks</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {draft.picks.map((pick) => {
              const p = allplayers[pick.player_id];
              return (
                <div key={`${pick.draft_id}-${pick.pick_no}`} className="flex items-center gap-1.5 text-xs py-0.5">
                  <span className="w-8 shrink-0 text-right text-gray-600 text-[10px]">
                    {formatDraftPick(pick)}
                  </span>
                  <span className="w-6 shrink-0 text-center font-semibold text-gray-500">
                    {p?.position ?? "?"}
                  </span>
                  <span className="text-gray-200 truncate min-w-0" title={p?.full_name ?? pick.player_id}>
                    {p?.full_name ?? pick.player_id}
                  </span>
                  {p?.team && <span className="shrink-0 text-gray-600 text-[10px]">{p.team}</span>}
                  {pick.amount != null && (
                    <span className="ml-auto shrink-0 text-[10px] text-green-400">${pick.amount}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
