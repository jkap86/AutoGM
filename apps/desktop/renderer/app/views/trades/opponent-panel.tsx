import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  Roster,
} from "@autogm/shared";
import { CURRENT_SEASON } from "@autogm/shared";
import { Avatar } from "../../components/avatar";
import { formatRecord, formatTime } from "../../../lib/trade-utils";

// ── Fetch all player shares for a user across all their leagues ──────

type PartnerShares = Record<string, { count: number; leagueNames: string[] }>;
const partnerSharesCache: Record<string, PartnerShares> = {};

async function fetchPartnerShares(userId: string): Promise<PartnerShares> {
  if (partnerSharesCache[userId]) return partnerSharesCache[userId];

  const leagueList: { league_id: string; name: string }[] = await fetch(
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${CURRENT_SEASON}`,
  ).then((r) => r.json()).catch(() => []);

  const counts: PartnerShares = {};
  const BATCH = 6;
  for (let i = 0; i < leagueList.length; i += BATCH) {
    const chunk = leagueList.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map(async (lg) => {
        const rosters: { owner_id: string; players: string[] | null }[] = await fetch(
          `https://api.sleeper.app/v1/league/${lg.league_id}/rosters`,
        ).then((r) => r.json());
        const theirs = rosters.find((r) => r.owner_id === userId);
        return { leagueName: lg.name, players: theirs?.players ?? [] };
      }),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const pid of r.value.players) {
        if (!counts[pid]) counts[pid] = { count: 0, leagueNames: [] };
        counts[pid].count++;
        counts[pid].leagueNames.push(r.value.leagueName);
      }
    }
  }

  partnerSharesCache[userId] = counts;
  return counts;
}

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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700/40 bg-gray-900/20">
        <Avatar hash={partner.avatar} alt={partner.username} size={36} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-gray-100 truncate" title={partner.username}>
            {partner.username}
          </span>
          <span className="text-xs text-gray-500">
            {formatRecord(partner)} · {league.name}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-700/40 px-4 bg-gray-900/10">
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
            className={`px-3 py-2 text-xs font-medium transition ${
              tab === t.key
                ? "text-gray-100 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 max-h-96 overflow-y-auto">
        {tab === "roster" && (
          <PlayerSharesSection
            partner={partner}
            allplayers={allplayers}
          />
        )}
        {tab === "trades" && (
          <RecentTradesSection
            partnerId={partner.user_id}
            allplayers={allplayers}
            involvedPlayerIds={involvedPlayerIds}
            leagues={leagues}
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
}: {
  partner: Roster;
  allplayers: { [id: string]: Allplayer };
}) {
  const [shares, setShares] = useState<{ player_id: string; name: string; position: string; team: string; count: number; leagueNames: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedRef.current === partner.user_id) return;
    let cancelled = false;
    setLoading(true);
    fetchPartnerShares(partner.user_id).then((counts) => {
      if (cancelled) return;
      fetchedRef.current = partner.user_id;
      const list = Object.entries(counts)
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
      setShares(list);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [partner.user_id, allplayers]);

  if (loading) {
    return <p className="text-xs text-gray-500 text-center py-4">Loading player shares...</p>;
  }

  if (shares.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No players found</p>;
  }

  const totalLeagues = new Set(shares.flatMap((s) => s.leagueNames)).size;
  const maxCount = shares.length > 0 ? shares[0].count : 1;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400">
          {shares.length} players
        </span>
        <span className="text-[10px] text-gray-500">
          across {totalLeagues} league{totalLeagues !== 1 ? "s" : ""}
        </span>
      </div>
      {shares.map((s) => (
        <div
          key={s.player_id}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-gray-700/30 transition group"
          title={s.leagueNames.join(", ")}
        >
          <span className={`w-7 shrink-0 text-center text-[10px] font-bold rounded py-0.5 ${
            s.position === "QB" ? "text-red-400 bg-red-500/10" :
            s.position === "RB" ? "text-green-400 bg-green-500/10" :
            s.position === "WR" ? "text-blue-400 bg-blue-500/10" :
            s.position === "TE" ? "text-orange-400 bg-orange-500/10" :
            "text-gray-400 bg-gray-500/10"
          }`}>{s.position}</span>
          <span className="text-xs text-gray-200 truncate min-w-0 font-medium">{s.name}</span>
          {s.team && <span className="shrink-0 text-[10px] text-gray-600">{s.team}</span>}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <div className="w-16 h-1.5 rounded-full bg-gray-700/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500/60"
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-gray-400 w-6 text-right tabular-nums">
              {s.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Recent Trades in this league ----

type TradeTransaction = {
  transaction_id: string;
  league_id: string;
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
  leagues,
}: {
  partnerId: string;
  allplayers: { [id: string]: Allplayer };
  involvedPlayerIds: string[];
  leagues: { [league_id: string]: LeagueDetailed };
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
      .catch((err) => {
        console.warn('[opponent-panel] Failed to fetch opponent trades:', err)
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

  const leagueCount = new Set(trades.map((t) => t.league_name)).size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">
          {trades.length} trade{trades.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-gray-500">
          across {leagueCount} league{leagueCount !== 1 ? "s" : ""}
        </span>
      </div>
      {trades.map((tx) => {
        const rosterIds = tx.roster_ids;
        return (
          <div key={tx.transaction_id} className="rounded-lg bg-gray-900/40 border border-gray-700/30 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/30 border-b border-gray-700/20">
              <span className="text-[10px] font-medium text-gray-400">{formatTime(tx.status_updated)}</span>
              <span className="text-[10px] text-gray-600 truncate" title={tx.league_name}>{tx.league_name}</span>
            </div>
            <div className="flex divide-x divide-gray-700/30">
              {rosterIds.map((rid) => {
                const got = Object.entries(tx.adds ?? {})
                  .filter(([, r]) => r === rid)
                  .map(([pid]) => ({ pid, name: allplayers[pid]?.full_name ?? pid, pos: allplayers[pid]?.position, involved: involvedSet.has(pid) }));
                const gave = Object.entries(tx.drops ?? {})
                  .filter(([, r]) => r === rid)
                  .map(([pid]) => ({ pid, name: allplayers[pid]?.full_name ?? pid, pos: allplayers[pid]?.position, involved: involvedSet.has(pid) }));
                if (got.length === 0 && gave.length === 0) return null;
                const rosterUser = leagues[tx.league_id]?.rosters.find((r) => r.roster_id === rid);
                const rosterName = rosterUser?.username ?? `Roster ${rid}`;
                return (
                  <div key={rid} className="flex-1 min-w-0 px-3 py-2">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{rosterName}</span>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {got.map((p, i) => (
                        <span
                          key={`g${i}`}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                            p.involved
                              ? "bg-green-500/15 text-green-300 font-medium border border-green-500/20"
                              : "text-green-400/60"
                          }`}
                        >
                          <span className="text-green-500/70">+</span>
                          {p.pos && <span className="text-[10px] font-semibold opacity-60">{p.pos}</span>}
                          <span className="truncate">{p.name}</span>
                        </span>
                      ))}
                      {gave.map((p, i) => (
                        <span
                          key={`s${i}`}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                            p.involved
                              ? "bg-red-500/15 text-red-300 font-medium border border-red-500/20"
                              : "text-red-400/60"
                          }`}
                        >
                          <span className="text-red-500/70">-</span>
                          {p.pos && <span className="text-[10px] font-semibold opacity-60">{p.pos}</span>}
                          <span className="truncate">{p.name}</span>
                        </span>
                      ))}
                    </div>
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
      .catch((err) => {
        console.warn('[opponent-panel] Failed to fetch opponent drafts:', err)
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
    <div className="flex flex-col gap-4">
      {grouped.map((draft) => (
        <div key={draft.draft_id} className="rounded-lg bg-gray-900/40 border border-gray-700/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-900/30 border-b border-gray-700/20">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {draft.season} {draft.type}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">{draft.picks.length} picks</span>
          </div>
          <div className="flex flex-col divide-y divide-gray-700/15">
            {draft.picks.map((pick) => {
              const p = allplayers[pick.player_id];
              return (
                <div
                  key={`${pick.draft_id}-${pick.pick_no}`}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700/20 transition"
                >
                  <span className="w-9 shrink-0 text-right text-[11px] font-bold font-[family-name:var(--font-heading)] text-gray-500 tabular-nums">
                    {formatDraftPick(pick)}
                  </span>
                  <span className={`w-7 shrink-0 text-center text-[10px] font-bold rounded py-0.5 ${
                    p?.position === "QB" ? "text-red-400 bg-red-500/10" :
                    p?.position === "RB" ? "text-green-400 bg-green-500/10" :
                    p?.position === "WR" ? "text-blue-400 bg-blue-500/10" :
                    p?.position === "TE" ? "text-orange-400 bg-orange-500/10" :
                    "text-gray-400 bg-gray-500/10"
                  }`}>
                    {p?.position ?? "?"}
                  </span>
                  <span className="text-xs text-gray-200 font-medium truncate min-w-0" title={p?.full_name ?? pick.player_id}>
                    {p?.full_name ?? pick.player_id}
                  </span>
                  {p?.team && <span className="shrink-0 text-[10px] text-gray-600">{p.team}</span>}
                  {pick.amount != null && (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-green-400 bg-green-500/10 rounded px-1.5 py-0.5">${pick.amount}</span>
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
