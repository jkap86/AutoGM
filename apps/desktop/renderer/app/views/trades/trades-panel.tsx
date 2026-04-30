import { useEffect, useMemo, useState } from "react";
import type { LeagueDetailed, Allplayer } from "@autogm/shared";
import { ConfirmModal } from "../../components/confirm-modal";
import type { TradeWithLeague } from "../../../hooks/use-trades-by-status";
import { Avatar } from "../../components/avatar";
import { RosterColumn } from "../../components/roster-column";
import { getPickId } from "../../../lib/leagues";
import {
  getPickKtcName,
  passThreshold,
  type TradeValueFilter,
} from "../../../hooks/use-trade-value-filter";
import { formatRecord, formatTime } from "../../../lib/trade-utils";

// DmPanel was extracted to dm-panel.tsx — import for local use + re-export
import { DmPanel } from "./dm-panel";
import { LeagueChatPanel } from "./league-chat-panel";
import { OpponentPanel } from "./opponent-panel";
import { LeagueSettingsPanel } from "./league-settings-panel";
export { DmPanel };

export type TradeAction = (trade: TradeWithLeague) => Promise<void>;

export type CounterOffer = {
  trade: TradeWithLeague;
  playerIdsToGive: string[];
  playerIdsToReceive: string[];
  pickIdsToGive: string[];
  pickIdsToReceive: string[];
  expiresAt?: number | null;
};

export function TradesPanel({
  trades,
  loading,
  error,
  leagues,
  allplayers,
  userId,
  statusLabel,
  emptyMessage,
  onAccept,
  onReject,
  onCounter,
  onWithdraw,
  onModify,
  ktc,
  filter,
}: {
  trades: TradeWithLeague[];
  loading: boolean;
  error: string | null;
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [player_id: string]: Allplayer };
  userId: string;
  statusLabel: string;
  emptyMessage: string;
  onAccept?: TradeAction;
  onReject?: TradeAction;
  onCounter?: (data: CounterOffer) => Promise<void>;
  onWithdraw?: TradeAction;
  onModify?: (data: CounterOffer) => Promise<void>;
  ktc?: Record<string, number>;
  filter?: TradeValueFilter;
}) {
  const resolveRoster = (league_id: string, roster_id: number) => {
    const league = leagues[league_id];
    return league?.rosters.find((r) => r.roster_id === roster_id);
  };

  const resolvePickOrder = (league_id: string, roster_id: number, season: string, round: number) => {
    const league = leagues[league_id];
    if (!league) return null;
    for (const roster of league.rosters) {
      const pick = roster.draftpicks.find(
        (dp) => dp.roster_id === roster_id && dp.season === season && dp.round === round,
      );
      if (pick?.order != null) return pick.order;
    }
    return null;
  };

  const formatPick = (league_id: string, dp: { roster_id: number; season: string; round: number; previous_owner_id: number }) => {
    const order = resolvePickOrder(league_id, dp.roster_id, dp.season, dp.round);
    const orig = resolveRoster(league_id, dp.roster_id);
    const showOwner = orig && orig.roster_id !== dp.previous_owner_id;
    if (order != null) {
      return `${dp.season} ${dp.round}.${String(order).padStart(2, '0')}${showOwner ? ` (${orig.username})` : ''}`;
    }
    return `${dp.season} Round ${dp.round}${showOwner ? ` (${orig.username})` : ''}`;
  };

  const [dirFilter, setDirFilter] = useState<"all" | "received" | "outgoing">("all");
  const [filterLeague, setFilterLeague] = useState<string>("all");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  // Player filters: pid → "any" | "acquired" | "moved"
  const [playerFilters, setPlayerFilters] = useState<Record<string, "any" | "acquired" | "moved">>({});

  const addPlayerFilter = (pid: string) => {
    if (playerFilters[pid]) return;
    setPlayerFilters((p) => ({ ...p, [pid]: "any" }));
  };
  const removePlayerFilter = (pid: string) => {
    setPlayerFilters((p) => { const { [pid]: _, ...rest } = p; return rest; });
  };
  const setPlayerFilterDir = (pid: string, dir: "any" | "acquired" | "moved") => {
    setPlayerFilters((p) => ({ ...p, [pid]: dir }));
  };

  // Build unique filter options from the current trades
  const filterOptions = useMemo(() => {
    const leagueSet = new Map<string, string>();
    const partnerSet = new Map<string, string>();
    const playerSet = new Map<string, string>();

    for (const t of trades) {
      leagueSet.set(t.league_id, t.league_name);

      const league = leagues[t.league_id];
      if (league) {
        const partnerRid = t.roster_ids.find((rid) => rid !== league.user_roster?.roster_id);
        const partner = league.rosters.find((r) => r.roster_id === partnerRid);
        if (partner) partnerSet.set(partner.user_id, partner.username);
      }

      for (const pid of [...Object.keys(t.adds ?? {}), ...Object.keys(t.drops ?? {})]) {
        const name = allplayers[pid]?.full_name;
        if (name) playerSet.set(pid, name);
      }
    }

    return {
      leagues: [...leagueSet.entries()].sort(([, a], [, b]) => a.localeCompare(b)),
      partners: [...partnerSet.entries()].sort(([, a], [, b]) => a.localeCompare(b)),
      players: [...playerSet.entries()].sort(([, a], [, b]) => a.localeCompare(b)),
    };
  }, [trades, leagues, allplayers]);

  const dirFiltered = useMemo(() => {
    let list = dirFilter === "all" ? trades
      : dirFilter === "received" ? trades.filter((t) => t.creator !== userId)
      : trades.filter((t) => t.creator === userId);

    if (filterLeague !== "all") {
      list = list.filter((t) => t.league_id === filterLeague);
    }
    if (filterPartner !== "all") {
      list = list.filter((t) => {
        const league = leagues[t.league_id];
        if (!league) return false;
        const partnerRid = t.roster_ids.find((rid) => rid !== league.user_roster?.roster_id);
        const partner = league.rosters.find((r) => r.roster_id === partnerRid);
        return partner?.user_id === filterPartner;
      });
    }
    const pfEntries = Object.entries(playerFilters);
    if (pfEntries.length > 0) {
      list = list.filter((t) => {
        const league = leagues[t.league_id];
        const userRid = league?.user_roster?.roster_id;
        return pfEntries.every(([pid, dir]) => {
          const adds = t.adds ?? {};
          const drops = t.drops ?? {};
          const involved = pid in adds || pid in drops;
          if (!involved) return false;
          if (dir === "any") return true;
          // "acquired" = user receives (adds to user roster)
          if (dir === "acquired") return adds[pid] === userRid;
          // "moved" = user sends away (drops from user roster)
          if (dir === "moved") return drops[pid] === userRid;
          return true;
        });
      });
    }

    return list;
  }, [trades, dirFilter, filterLeague, filterPartner, playerFilters, userId, leagues]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl flex justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading trades...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center py-12 gap-3">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center py-12 gap-3">
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      {(() => {
        const pfCount = Object.keys(playerFilters).length;
        const hasFilters = filterLeague !== "all" || filterPartner !== "all" || pfCount > 0;
        const activeCount = (filterLeague !== "all" ? 1 : 0) + (filterPartner !== "all" ? 1 : 0) + pfCount;
        return (
          <div className="mb-5 rounded-xl border border-gray-700/60 bg-gray-800/50 overflow-hidden">
            {/* Top row: title + direction + count */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-gray-700/20 to-transparent">
              <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-gray-100">
                {statusLabel}
              </h2>
              <span className="text-sm text-gray-500 font-medium tabular-nums">
                {dirFiltered.length} {dirFiltered.length === 1 ? "trade" : "trades"}
              </span>
              <div className="flex items-center gap-0.5 ml-auto rounded-lg bg-gray-900/50 p-0.5">
                {(["all", "received", "outgoing"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirFilter(d)}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-semibold capitalize transition ${
                      dirFilter === d
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter row */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-700/30 flex-wrap">
              {/* League */}
              <select
                value={filterLeague}
                onChange={(e) => setFilterLeague(e.target.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  filterLeague !== "all"
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                    : "border-gray-700/50 bg-gray-900/50 text-gray-400 hover:border-gray-600/60"
                } focus:border-blue-500/50 focus:outline-none`}
              >
                <option value="all">League: All ({filterOptions.leagues.length})</option>
                {filterOptions.leagues.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              {/* Partner */}
              <select
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  filterPartner !== "all"
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                    : "border-gray-700/50 bg-gray-900/50 text-gray-400 hover:border-gray-600/60"
                } focus:border-blue-500/50 focus:outline-none`}
              >
                <option value="all">Partner: All ({filterOptions.partners.length})</option>
                {filterOptions.partners.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              {/* Player add */}
              <select
                value=""
                onChange={(e) => { if (e.target.value) addPlayerFilter(e.target.value); }}
                className="rounded-lg border border-gray-700/50 bg-gray-900/50 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:border-gray-600/60 focus:border-blue-500/50 focus:outline-none transition cursor-pointer"
              >
                <option value="">+ Player / Pick ({filterOptions.players.length})</option>
                {filterOptions.players
                  .filter(([id]) => !playerFilters[id])
                  .map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
              </select>

              {hasFilters && (
                <button
                  onClick={() => { setFilterLeague("all"); setFilterPartner("all"); setPlayerFilters({}); }}
                  className="flex items-center gap-1 rounded-lg border border-gray-700/50 bg-gray-900/50 px-2.5 py-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-300 hover:border-gray-600/60 transition"
                >
                  <span>&times;</span>
                  Clear{activeCount > 1 ? ` (${activeCount})` : ""}
                </button>
              )}
            </div>

            {/* Active player filter chips */}
            {pfCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-700/20 flex-wrap">
                {Object.entries(playerFilters).map(([pid, dir]) => {
                  const name = allplayers[pid]?.full_name ?? pid;
                  const pos = allplayers[pid]?.position;
                  return (
                    <div
                      key={pid}
                      className="flex items-center gap-0.5 rounded-lg border border-blue-500/30 bg-blue-500/5 pl-2 pr-1 py-0.5"
                    >
                      {pos && <span className="text-[10px] font-bold text-blue-400/50">{pos}</span>}
                      <span className="text-xs font-medium text-blue-300 truncate max-w-[120px]" title={name}>{name}</span>
                      <div className="flex items-center gap-0 ml-1 rounded bg-gray-900/60 p-0.5">
                        {(["any", "acquired", "moved"] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setPlayerFilterDir(pid, d)}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition ${
                              dir === d
                                ? d === "acquired" ? "bg-green-600 text-white"
                                  : d === "moved" ? "bg-red-600 text-white"
                                  : "bg-blue-600 text-white"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {d === "any" ? "Both" : d === "acquired" ? "Got" : "Sent"}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => removePlayerFilter(pid)}
                        className="text-gray-500 hover:text-gray-300 text-xs px-1"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <TradeCards
        trades={dirFiltered}
        leagues={leagues}
        allplayers={allplayers}
        userId={userId}
        tabStatus={statusLabel}
        resolveRoster={resolveRoster}
        formatPick={formatPick}
        formatTime={formatTime}
        onAccept={onAccept}
        onReject={onReject}
        onCounter={onCounter}
        onWithdraw={onWithdraw}
        onModify={onModify}
        ktc={ktc}
        filter={filter}
      />
    </div>
  );
}

function TradeCards({
  trades,
  leagues,
  allplayers,
  userId,
  tabStatus,
  resolveRoster,
  formatPick,
  formatTime,
  onAccept,
  onReject,
  onCounter,
  onWithdraw,
  onModify,
  ktc,
  filter,
}: {
  trades: TradeWithLeague[];
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [player_id: string]: Allplayer };
  userId: string;
  tabStatus: string;
  resolveRoster: (league_id: string, roster_id: number) => import("@autogm/shared").Roster | undefined;
  formatPick: (league_id: string, dp: { roster_id: number; season: string; round: number; previous_owner_id: number }) => string;
  formatTime: (epoch: number) => string;
  onAccept?: TradeAction;
  onReject?: TradeAction;
  onCounter?: (data: CounterOffer) => Promise<void>;
  onWithdraw?: TradeAction;
  onModify?: (data: CounterOffer) => Promise<void>;
  ktc?: Record<string, number>;
  filter?: TradeValueFilter;
}) {
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedTab, setExpandedTab] = useState<Record<string, string>>({});
  const [counterTradeId, setCounterTradeId] = useState<string | null>(null);
  const [counterMode, setCounterMode] = useState<"counter" | "modify">("counter");
  const [counterGive, setCounterGive] = useState<Set<string>>(new Set());
  const [counterReceive, setCounterReceive] = useState<Set<string>>(new Set());
  const [counterPicksGive, setCounterPicksGive] = useState<Set<string>>(new Set());
  const [counterPicksReceive, setCounterPicksReceive] = useState<Set<string>>(new Set());
  const [counterExpiresAt, setCounterExpiresAt] = useState<number | null>(null);
  // Confirmation state: { tradeId, action } or null
  const [confirmAction, setConfirmAction] = useState<{ trade: TradeWithLeague; action: "accept" | "reject" | "withdraw" } | null>(null);

  const toggleExpand = (key: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleAction = async (trade: TradeWithLeague, action: "accept" | "reject" | "withdraw") => {
    const fn = action === "accept" ? onAccept : action === "reject" ? onReject : onWithdraw;
    if (!fn) return;
    setActionLoading((prev) => ({ ...prev, [trade.transaction_id]: action }));
    setActionError((prev) => { const next = { ...prev }; delete next[trade.transaction_id]; return next; });
    try {
      await fn(trade);
    } catch (e) {
      setActionError((prev) => ({
        ...prev,
        [trade.transaction_id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setActionLoading((prev) => { const next = { ...prev }; delete next[trade.transaction_id]; return next; });
    }
  };

  const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const enterCounter = (trade: TradeWithLeague, mode: "counter" | "modify" = "counter") => {
    const league = leagues[trade.league_id];
    const userRid = league?.user_roster?.roster_id;
    // User's "giving" = players moving away from their roster (drops with user's rid)
    const giving = new Set(
      Object.entries(trade.drops ?? {}).filter(([, rid]) => rid === userRid).map(([pid]) => pid),
    );
    const receiving = new Set(
      Object.entries(trade.adds ?? {}).filter(([, rid]) => rid === userRid).map(([pid]) => pid),
    );
    const parsedPicks = (trade.draft_picks ?? []).map((s) => {
      const [roster_id, season, round, owner_id, previous_owner_id] = s.split(",");
      return { roster_id: +roster_id, season, round: +round, owner_id: +owner_id, previous_owner_id: +previous_owner_id };
    });
    const partnerRid = trade.roster_ids.find((rid) => rid !== userRid);
    const partnerRoster = league?.rosters.find((r) => r.roster_id === partnerRid);
    const pGive = new Set(
      parsedPicks
        .filter((dp) => dp.previous_owner_id === userRid)
        .map((dp) => {
          const rp = league.user_roster.draftpicks.find((p) => p.roster_id === dp.roster_id && p.season === dp.season && p.round === dp.round);
          return rp ? getPickId(rp) : null;
        })
        .filter((x): x is string => x !== null),
    );
    const pRecv = new Set(
      parsedPicks
        .filter((dp) => dp.owner_id === userRid)
        .map((dp) => {
          const rp = partnerRoster?.draftpicks.find((p) => p.roster_id === dp.roster_id && p.season === dp.season && p.round === dp.round);
          return rp ? getPickId(rp) : null;
        })
        .filter((x): x is string => x !== null),
    );
    setCounterTradeId(trade.transaction_id);
    setCounterMode(mode);
    setCounterGive(giving);
    setCounterReceive(receiving);
    setCounterPicksGive(pGive);
    setCounterPicksReceive(pRecv);
    const rawExp = (trade.settings as Record<string, unknown>)?.expires_at;
    setCounterExpiresAt(typeof rawExp === 'number' ? (rawExp < 10_000_000_000 ? rawExp * 1000 : rawExp) : null);
    setExpandedCards((prev) => new Set([...prev, trade.transaction_id]));
  };

  const cancelCounter = () => {
    setCounterTradeId(null);
    setCounterGive(new Set());
    setCounterReceive(new Set());
    setCounterPicksGive(new Set());
    setCounterPicksReceive(new Set());
    setCounterExpiresAt(null);
  };

  const sendCounter = async (trade: TradeWithLeague, mode: "counter" | "modify" = "counter") => {
    const fn = mode === "modify" ? onModify : onCounter;
    if (!fn) return;
    setActionLoading((prev) => ({ ...prev, [trade.transaction_id]: mode }));
    setActionError((prev) => { const next = { ...prev }; delete next[trade.transaction_id]; return next; });
    try {
      await fn({
        trade,
        playerIdsToGive: [...counterGive],
        playerIdsToReceive: [...counterReceive],
        pickIdsToGive: [...counterPicksGive],
        pickIdsToReceive: [...counterPicksReceive],
        expiresAt: counterExpiresAt,
      });
      cancelCounter();
    } catch (e) {
      setActionError((prev) => ({
        ...prev,
        [trade.transaction_id]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setActionLoading((prev) => { const next = { ...prev }; delete next[trade.transaction_id]; return next; });
    }
  };

  const lookup = filter?.valueLookup ?? ktc ?? undefined;
  const formatValue = filter?.formatValue ?? ((n: number) => Math.round(n).toLocaleString());
  const valueLabel = filter?.valueLabel ?? "KTC";

  // Apply threshold filtering when a filter is provided
  const visibleTrades = filter
    ? trades.filter((trade) => {
        const league = leagues[trade.league_id];
        const userRid = league?.user_roster?.roster_id;
        const partnerRid = trade.roster_ids.find((rid) => rid !== userRid);
        if (userRid == null || partnerRid == null) return true;
        const uv = filter.getValue(trade.league_id, userRid);
        const pv = filter.getValue(trade.league_id, partnerRid);
        const ur = filter.getRank(trade.league_id, userRid);
        const pr = filter.getRank(trade.league_id, partnerRid);
        return (
          passThreshold(uv, filter.userValueFilter) &&
          passThreshold(pv, filter.partnerValueFilter) &&
          passThreshold(ur, filter.userRankFilter) &&
          passThreshold(pr, filter.partnerRankFilter)
        );
      })
    : trades;

  return (
    <div className="flex flex-col gap-3">
      {visibleTrades.map((trade) => {
        const league = leagues[trade.league_id];
        const rosterIds = trade.roster_ids;
        const parsedPicks = (trade.draft_picks ?? []).map((s) => {
          const [roster_id, season, round, owner_id, previous_owner_id] = s.split(',');
          return { roster_id: +roster_id, season, round: +round, owner_id: +owner_id, previous_owner_id: +previous_owner_id };
        }).sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
        const userRid = league?.user_roster?.roster_id;
        const sortedRosterIds = [...rosterIds].sort((a, b) => (a === userRid ? -1 : b === userRid ? 1 : 0));
        const totalTeams = league?.rosters.length ?? 0;
        const sides = sortedRosterIds.map((rid) => {
          const roster = resolveRoster(trade.league_id, rid);
          const receivingPids = Object.entries(trade.adds ?? {}).filter(([, rId]) => rId === rid).map(([pid]) => pid);
          const givingPids = Object.entries(trade.drops ?? {}).filter(([, rId]) => rId === rid).map(([pid]) => pid);
          const findPickOrder = (leagueId: string, rosterId: number, season: string, round: number) => {
            const lg = leagues[leagueId];
            if (!lg) return null;
            for (const r of lg.rosters) {
              const match = r.draftpicks.find(
                (dp) => dp.roster_id === rosterId && String(dp.season) === String(season) && dp.round === round,
              );
              if (match?.order != null) return match.order;
            }
            return null;
          };
          const pickValue = (dp: typeof parsedPicks[0], ownerId: number | string) => {
            const order = findPickOrder(trade.league_id, dp.roster_id, dp.season, dp.round);
            if (order && order > 0) {
              const specificKey = `${dp.season} ${dp.round}.${String(order).padStart(2, '0')}`;
              if (lookup && lookup[specificKey] != null) return lookup[specificKey];
            }
            const ktcName = getPickKtcName(dp.season, dp.round, order);
            return lookup ? (lookup[ktcName] ?? 0) : 0;
          };
          const receiving = [
            ...receivingPids.map((pid) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position, value: lookup?.[pid] ?? 0 })),
            ...parsedPicks
              .filter((dp) => dp.owner_id === rid)
              .map((dp) => ({ type: 'pick' as const, label: formatPick(trade.league_id, dp), position: undefined, value: pickValue(dp, rid) })),
          ];
          const giving = [
            ...givingPids.map((pid) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position, value: lookup?.[pid] ?? 0 })),
            ...parsedPicks
              .filter((dp) => dp.previous_owner_id === rid)
              .map((dp) => ({ type: 'pick' as const, label: formatPick(trade.league_id, dp), position: undefined, value: pickValue(dp, rid) })),
          ];
          const vReceiving = lookup
            ? receivingPids.reduce((sum, pid) => sum + (lookup[pid] ?? 0), 0)
              + parsedPicks.filter((dp) => dp.owner_id === rid).reduce((sum, dp) => sum + pickValue(dp, rid), 0)
            : 0;
          const vGiving = lookup
            ? givingPids.reduce((sum, pid) => sum + (lookup[pid] ?? 0), 0)
              + parsedPicks.filter((dp) => dp.previous_owner_id === rid).reduce((sum, dp) => sum + pickValue(dp, rid), 0)
            : 0;
          const teamValue = filter ? filter.getValue(trade.league_id, rid) : null;
          const teamRank = filter ? filter.getRank(trade.league_id, rid) : null;
          return { roster, roster_id: rid, receiving, giving, vReceiving, vGiving, teamValue, teamRank };
        });

        const isReceived = trade.creator !== userId;
        const loadingAction = actionLoading[trade.transaction_id];
        const error = actionError[trade.transaction_id];
        const isExpanded = expandedCards.has(trade.transaction_id);
        const isCounter = counterTradeId === trade.transaction_id;

        // When in counter mode, override sides to reflect the counter selections
        if (isCounter) {
          for (const side of sides) {
            const isUserSide = side.roster_id === userRid;
            const playerGive = isUserSide ? counterGive : counterReceive;
            const playerRecv = isUserSide ? counterReceive : counterGive;
            const pickGive = isUserSide ? counterPicksGive : counterPicksReceive;
            const pickRecv = isUserSide ? counterPicksReceive : counterPicksGive;
            const partnerRid2 = sortedRosterIds.find((rid) => rid !== side.roster_id);
            const partnerRoster2 = league?.rosters.find((r) => r.roster_id === partnerRid2);

            side.receiving = [
              ...[...playerRecv].map((pid) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position, value: lookup?.[pid] ?? 0 })),
              ...[...pickRecv].flatMap((pickId) => {
                const source = isUserSide ? partnerRoster2 : league?.user_roster;
                const rp = source?.draftpicks.find((d) => getPickId(d) === pickId);
                if (!rp) return [];
                return [{ type: 'pick' as const, label: formatPick(trade.league_id, { roster_id: rp.roster_id, season: rp.season, round: rp.round, previous_owner_id: side.roster_id }), position: undefined, value: lookup ? (lookup[pickId] ?? 0) : 0 }];
              }),
            ];
            side.giving = [
              ...[...playerGive].map((pid) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position, value: lookup?.[pid] ?? 0 })),
              ...[...pickGive].flatMap((pickId) => {
                const source = isUserSide ? league?.user_roster : partnerRoster2;
                const rp = source?.draftpicks.find((d) => getPickId(d) === pickId);
                if (!rp) return [];
                return [{ type: 'pick' as const, label: formatPick(trade.league_id, { roster_id: rp.roster_id, season: rp.season, round: rp.round, previous_owner_id: side.roster_id }), position: undefined, value: lookup ? (lookup[pickId] ?? 0) : 0 }];
              }),
            ];
            side.vReceiving = side.receiving.reduce((sum, item) => sum + item.value, 0);
            side.vGiving = side.giving.reduce((sum, item) => sum + item.value, 0);
          }
        }

        // Collect player IDs involved in the trade for highlighting
        const userRosterId = userRid;
        const userAdds = Object.entries(trade.adds ?? {}).filter(([, rId]) => rId === userRosterId).map(([pid]) => pid);
        const userDrops = Object.entries(trade.drops ?? {}).filter(([, rId]) => rId === userRosterId).map(([pid]) => pid);

        return (
          <div
            key={trade.transaction_id}
            className="rounded-xl border border-gray-700/80 bg-gray-800 overflow-hidden shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/40 hover:border-gray-600/80 hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Countdown timer */}
            <ExpirationTimer expiresAt={(trade.settings as Record<string, unknown>)?.expires_at} tabStatus={tabStatus} />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gradient-to-b from-gray-700/30 to-transparent">
              <div className="flex items-center gap-2.5">
                {league && <Avatar hash={league.avatar} alt={league.name} size={20} />}
                <span title={trade.league_name} className="text-sm font-medium text-gray-200 truncate">
                  {trade.league_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-1 text-xs font-medium ${
                  trade.creator === userId
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-orange-500/15 text-orange-400"
                }`}>
                  {trade.creator === userId ? "Outgoing" : "Received"}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(trade.status_updated)}
                </span>
                <button
                  onClick={() => toggleExpand(trade.transaction_id)}
                  className="text-gray-500 hover:text-gray-300 transition"
                  title={isExpanded ? "Collapse rosters" : "Expand rosters"}
                  aria-expanded={isExpanded}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Trade body */}
            <div className="flex flex-col sm:flex-row items-stretch divide-x divide-gray-700/40" style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
              {sides.map((side, i) => (
                <div key={side.roster_id} className="flex-1 flex flex-col">
                  {i > 0 && <div className="sm:hidden border-t border-gray-700/50" />}
                  {/* User info */}
                  <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                    <Avatar
                      hash={side.roster?.avatar}
                      alt={side.roster?.username ?? `Roster ${side.roster_id}`}
                      size={32}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span title={side.roster?.username ?? `Roster ${side.roster_id}`} className="text-sm font-semibold text-gray-100 truncate">
                        {side.roster?.username ?? `Roster ${side.roster_id}`}
                      </span>
                      {side.roster && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 font-medium">{formatRecord(side.roster)}</span>
                          {side.teamRank != null && (
                            <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-400">
                              #{side.teamRank}/{totalTeams}
                            </span>
                          )}
                          {side.teamValue != null && side.teamValue > 0 && (
                            <span className="text-[10px] font-medium text-gray-500">
                              {formatValue(side.teamValue)} {valueLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {lookup && (side.vReceiving > 0 || side.vGiving > 0) && (
                      <span className={`shrink-0 text-sm font-bold font-[family-name:var(--font-heading)] rounded-lg px-2.5 py-1 ${
                        side.vReceiving >= side.vGiving
                          ? "text-green-400 bg-green-500/10 shadow-sm shadow-green-900/20"
                          : "text-red-400 bg-red-500/10 shadow-sm shadow-red-900/20"
                      }`}>
                        {side.vReceiving >= side.vGiving ? "+" : ""}
                        {formatValue(side.vReceiving - side.vGiving)}
                      </span>
                    )}
                  </div>

                  {/* Trade items */}
                  <div className="px-4 pb-3 flex gap-4">
                    {side.receiving.length > 0 && (
                      <div className="flex-1">
                        <span className="text-[10px] uppercase tracking-wider text-green-500/70 font-semibold">Receives</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {side.receiving.map((item, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/20 shadow-sm shadow-green-900/20 px-2 py-1"
                            >
                              {item.position && (
                                <span className="text-[10px] text-green-500/60 font-bold">{item.position}</span>
                              )}
                              <span className="text-xs text-green-300 truncate">{item.label}</span>
                              {item.value > 0 && (
                                <span className="ml-auto text-[10px] font-semibold text-green-400/60 tabular-nums shrink-0">
                                  {formatValue(item.value)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {side.giving.length > 0 && (
                      <div className="flex-1">
                        <span className="text-[10px] uppercase tracking-wider text-red-500/70 font-semibold">Sends</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {side.giving.map((item, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 shadow-sm shadow-red-900/20 px-2 py-1"
                            >
                              {item.position && (
                                <span className="text-[10px] text-red-500/60 font-bold">{item.position}</span>
                              )}
                              <span className="text-xs text-red-300 truncate">{item.label}</span>
                              {item.value > 0 && (
                                <span className="ml-auto text-[10px] font-semibold text-red-400/60 tabular-nums shrink-0">
                                  {formatValue(item.value)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Expanded section with tabs */}
            {(isExpanded || isCounter) && sides.length === 2 && sides[0].roster && sides[1].roster && (() => {
              const tabs = ["Rosters", "DM", "League Chat", "Opponent", "Settings"];
              const activeTab = expandedTab[trade.transaction_id] || "Rosters";
              return (
                <div className="border-t border-gray-700/40" style={{ boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25)' }}>
                  {/* Tab bar */}
                  <div className="flex border-b border-gray-700/40 px-4">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setExpandedTab((prev) => ({ ...prev, [trade.transaction_id]: tab }))}
                        className={`px-3 py-1.5 text-xs font-medium transition ${
                          activeTab === tab
                            ? "text-gray-100 border-b-2 border-blue-500"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {activeTab === "Rosters" && (
                    <div className="px-4 py-3">
                      {isCounter && (
                        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-600/25 px-3 py-2 mb-3">
                          <span className="text-yellow-400 text-sm">&#9998;</span>
                          <span className="text-xs text-yellow-300/90 font-medium">Click players or picks to add/remove from counter-offer</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {sides.map((side) => {
                          const isUserSide = side.roster_id === userRosterId;
                          return (
                            <RosterColumn
                              key={side.roster_id}
                              roster={side.roster!}
                              allplayers={allplayers}
                              label={isCounter ? (isUserSide ? "Your Roster" : side.roster!.username) : side.roster!.username}
                              highlightIds={
                                isCounter
                                  ? [...(isUserSide ? counterGive : counterReceive)]
                                  : (isUserSide ? userDrops : userAdds)
                              }
                              highlightColor={isUserSide ? "red" : "green"}
                              highlightPickIds={
                                isCounter ? [...(isUserSide ? counterPicksGive : counterPicksReceive)] : undefined
                              }
                              onToggle={isCounter ? toggleInSet(isUserSide ? setCounterGive : setCounterReceive) : undefined}
                              onTogglePick={isCounter ? toggleInSet(isUserSide ? setCounterPicksGive : setCounterPicksReceive) : undefined}
                              rosterPositions={league?.roster_positions}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === "DM" && (() => {
                    const partnerSide = sides.find((s) => s.roster_id !== userRosterId);
                    const partnerId = partnerSide?.roster?.user_id;
                    if (!partnerId) return <div className="px-4 py-6 text-center text-xs text-gray-500">Unknown partner</div>;
                    return <DmPanel userId={userId} partnerId={partnerId} partnerName={partnerSide?.roster?.username ?? "Leaguemate"} leagues={leagues} />;
                  })()}

                  {activeTab === "League Chat" && league && (
                    <LeagueChatPanel
                      userId={userId}
                      leagueId={trade.league_id}
                      leagueName={league.name}
                    />
                  )}

                  {activeTab === "Opponent" && (() => {
                    const partnerSide = sides.find((s) => s.roster_id !== userRosterId);
                    if (!partnerSide?.roster || !league) return <div className="px-4 py-6 text-center text-xs text-gray-500">Unknown partner</div>;
                    return (
                      <OpponentPanel
                        partner={partnerSide.roster}
                        league={league}
                        allplayers={allplayers}
                        leagues={leagues}
                        involvedPlayerIds={[
                          ...Object.keys(trade.adds ?? {}),
                          ...Object.keys(trade.drops ?? {}),
                        ]}
                      />
                    );
                  })()}

                  {activeTab === "Settings" && league && (
                    <LeagueSettingsPanel league={league} />
                  )}
                </div>
              );
            })()}

            {/* Action buttons */}
            {isCounter ? (
              <div className="flex flex-col border-t border-gray-700/40" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }}>
                {/* Expiration row */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700/30">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Expires</span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "None", days: null },
                      { label: "1d", days: 1 },
                      { label: "2d", days: 2 },
                      { label: "3d", days: 3 },
                      { label: "7d", days: 7 },
                    ].map((opt) => {
                      const optMs = opt.days ? Date.now() + opt.days * 86400000 : null;
                      const isSelected = opt.days === null
                        ? counterExpiresAt === null
                        : counterExpiresAt !== null && Math.abs(counterExpiresAt - (optMs ?? 0)) < 86400000;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => setCounterExpiresAt(opt.days ? Date.now() + opt.days * 86400000 : null)}
                          className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                              : "bg-gray-700/60 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="datetime-local"
                    value={counterExpiresAt ? new Date(counterExpiresAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setCounterExpiresAt(e.target.value ? new Date(e.target.value).getTime() : null)}
                    className="rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
                  />
                </div>
                {/* Actions row */}
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-xs text-gray-400">
                    Giving {counterGive.size + counterPicksGive.size} · Receiving {counterReceive.size + counterPicksReceive.size}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {error && <span className="text-xs text-red-400">{error}</span>}
                    <button
                      onClick={cancelCounter}
                      disabled={loadingAction === counterMode}
                      className="rounded-md bg-gray-700 border border-gray-600 px-3 py-1 text-xs font-medium text-gray-200 transition hover:bg-gray-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => sendCounter(trade, counterMode)}
                      disabled={loadingAction === counterMode || (counterGive.size + counterPicksGive.size + counterReceive.size + counterPicksReceive.size === 0)}
                      className={`rounded-md px-3 py-1 text-xs font-medium text-white transition disabled:opacity-50 ${
                        counterMode === "modify" ? "bg-blue-600 hover:bg-blue-500" : "bg-yellow-600 hover:bg-yellow-500"
                      }`}
                    >
                      {loadingAction === counterMode
                        ? counterMode === "modify" ? "Updating..." : "Sending..."
                        : counterMode === "modify" ? "Update Trade" : "Send Counter"}
                    </button>
                  </div>
                </div>
              </div>
            ) : isReceived && (onAccept || onReject || onCounter) ? (
              <div className="flex justify-between px-4 py-2.5 border-t border-gray-700/40" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }}>
                {onAccept && (
                  <button
                    onClick={() => setConfirmAction({ trade, action: "accept" })}
                    disabled={!!loadingAction}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-500 disabled:opacity-50"
                  >
                    {loadingAction === "accept" ? "Accepting..." : "Accept"}
                  </button>
                )}
                {onCounter && (
                  <button
                    onClick={() => enterCounter(trade, "counter")}
                    disabled={!!loadingAction}
                    className="rounded-md bg-gray-700 border border-gray-600 px-3 py-1 text-xs font-medium text-gray-200 transition hover:bg-gray-600 disabled:opacity-50"
                  >
                    Counter
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={() => setConfirmAction({ trade, action: "reject" })}
                    disabled={!!loadingAction}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    {loadingAction === "reject" ? "Rejecting..." : "Reject"}
                  </button>
                )}
                {error && (
                  <span className="text-xs text-red-400">{error}</span>
                )}
              </div>
            ) : !isReceived && (onWithdraw || onModify) ? (
              <div className="flex justify-between px-4 py-2.5 border-t border-gray-700/40" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }}>
                {onModify && (
                  <button
                    onClick={() => enterCounter(trade, "modify")}
                    disabled={!!loadingAction}
                    className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    Modify
                  </button>
                )}
                {onWithdraw && (
                  <button
                    onClick={() => setConfirmAction({ trade, action: "withdraw" })}
                    disabled={!!loadingAction}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    {loadingAction === "withdraw" ? "Withdrawing..." : "Withdraw"}
                  </button>
                )}
                {error && (
                  <span className="text-xs text-red-400">{error}</span>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.action === "accept"
              ? "Accept Trade"
              : confirmAction.action === "reject"
                ? "Reject Trade"
                : "Withdraw Trade"
          }
          message={
            confirmAction.action === "accept"
              ? "Are you sure you want to accept this trade? This cannot be undone."
              : confirmAction.action === "reject"
                ? "Are you sure you want to reject this trade?"
                : "Are you sure you want to withdraw this trade offer?"
          }
          confirmLabel={confirmAction.action === "accept" ? "Accept" : confirmAction.action === "reject" ? "Reject" : "Withdraw"}
          confirmColor={
            confirmAction.action === "accept"
              ? "bg-green-600 hover:bg-green-500"
              : "bg-red-600 hover:bg-red-500"
          }
          loading={!!actionLoading[confirmAction.trade.transaction_id]}
          onConfirm={async () => {
            await handleAction(confirmAction.trade, confirmAction.action);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function ExpirationTimer({ expiresAt, tabStatus }: { expiresAt: unknown; tabStatus: string }) {
  const isPending = tabStatus === 'Pending';
  const [now, setNow] = useState(Date.now());

  const expiresMs = typeof expiresAt === 'number'
    ? (expiresAt < 10_000_000_000 ? expiresAt * 1000 : expiresAt)
    : null;

  useEffect(() => {
    if (expiresMs === null || !isPending) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresMs, isPending]);

  if (expiresMs === null) return null;

  // Completed/rejected — no timer shown
  if (tabStatus === 'Completed' || tabStatus === 'Rejected') return null;

  // Expired tab — show the date/time it expired
  if (tabStatus === 'Expired') {
    const date = new Date(expiresMs);
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return (
      <div className="flex justify-center py-1 bg-red-500/10">
        <span className="text-xs font-medium text-red-400">
          Expired {label}
        </span>
      </div>
    );
  }

  // Pending — live countdown
  const diff = expiresMs - now;
  if (diff <= 0) {
    return (
      <div className="flex justify-center py-1 bg-red-500/10">
        <span className="text-xs font-bold font-[family-name:var(--font-heading)] text-red-400">
          EXPIRED
        </span>
      </div>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

  return (
    <div className="flex justify-center py-1 bg-red-500/10">
      <span className="text-xs font-bold font-[family-name:var(--font-heading)] tracking-wider text-red-400">
        {parts.join(' ')}
      </span>
    </div>
  );
}

