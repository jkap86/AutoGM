import { useState } from "react";
import type { LeagueDetailed, Allplayer } from "@sleepier/shared";
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
export { DmPanel };

export type TradeAction = (trade: TradeWithLeague) => Promise<void>;

export type CounterOffer = {
  trade: TradeWithLeague;
  playerIdsToGive: string[];
  playerIdsToReceive: string[];
  pickIdsToGive: string[];
  pickIdsToReceive: string[];
};

export function TradesPanel({
  trades,
  loading,
  error,
  refetch,
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
  refetch: () => void;
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
        <button
          onClick={refetch}
          className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center py-12 gap-3">
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
        <button
          onClick={refetch}
          className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-700 transition"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-gray-100">
            {statusLabel} Trades
          </h2>
          <span className="text-sm text-gray-500">
            {trades.length} {trades.length === 1 ? "trade" : "trades"}
          </span>
        </div>
        <button
          onClick={refetch}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition"
        >
          Refresh
        </button>
      </div>

      <TradeCards
        trades={trades}
        leagues={leagues}
        allplayers={allplayers}
        userId={userId}
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
  resolveRoster: (league_id: string, roster_id: number) => import("@sleepier/shared").Roster | undefined;
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
    setExpandedCards((prev) => new Set([...prev, trade.transaction_id]));
  };

  const cancelCounter = () => {
    setCounterTradeId(null);
    setCounterGive(new Set());
    setCounterReceive(new Set());
    setCounterPicksGive(new Set());
    setCounterPicksReceive(new Set());
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
          const receiving = [
            ...receivingPids.map((pid) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position })),
            ...parsedPicks
              .filter((dp) => dp.owner_id === rid)
              .map((dp) => ({ type: 'pick' as const, label: formatPick(trade.league_id, dp), position: undefined })),
          ];
          const giving = [
            ...givingPids.map((pid) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position })),
            ...parsedPicks
              .filter((dp) => dp.previous_owner_id === rid)
              .map((dp) => ({ type: 'pick' as const, label: formatPick(trade.league_id, dp), position: undefined })),
          ];
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
          const receivingPickKtcNames = parsedPicks
            .filter((dp) => dp.owner_id === rid)
            .map((dp) => getPickKtcName(dp.season, dp.round, findPickOrder(trade.league_id, dp.roster_id, dp.season, dp.round)));
          const givingPickKtcNames = parsedPicks
            .filter((dp) => dp.previous_owner_id === rid)
            .map((dp) => getPickKtcName(dp.season, dp.round, findPickOrder(trade.league_id, dp.roster_id, dp.season, dp.round)));
          const vReceiving = lookup
            ? receivingPids.reduce((sum, pid) => sum + (lookup[pid] ?? 0), 0)
              + receivingPickKtcNames.reduce((sum, name) => sum + (lookup[name] ?? 0), 0)
            : 0;
          const vGiving = lookup
            ? givingPids.reduce((sum, pid) => sum + (lookup[pid] ?? 0), 0)
              + givingPickKtcNames.reduce((sum, name) => sum + (lookup[name] ?? 0), 0)
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

        // Collect player IDs involved in the trade for highlighting
        const userRosterId = userRid;
        const userAdds = Object.entries(trade.adds ?? {}).filter(([, rId]) => rId === userRosterId).map(([pid]) => pid);
        const userDrops = Object.entries(trade.drops ?? {}).filter(([, rId]) => rId === userRosterId).map(([pid]) => pid);

        return (
          <div
            key={trade.transaction_id}
            className="rounded-xl border border-gray-700/80 bg-gray-800/60 overflow-hidden hover:border-gray-600/80 transition"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40">
              <div className="flex items-center gap-2.5">
                {league && <Avatar hash={league.avatar} alt={league.name} size={20} />}
                <span title={trade.league_name} className="text-sm font-medium text-gray-200 truncate">
                  {trade.league_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  trade.creator === userId
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-orange-500/15 text-orange-400"
                }`}>
                  {trade.creator === userId ? "Outgoing" : "Received"}
                </span>
                <span className="text-[11px] text-gray-500">
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
            <div className="flex items-stretch">
              {sides.map((side, i) => (
                <div key={side.roster_id} className="flex-1 flex flex-col">
                  {i > 0 && (
                    <div className="absolute inset-y-0 left-0 w-px bg-gray-700/50" />
                  )}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Avatar
                      hash={side.roster?.avatar}
                      alt={side.roster?.username ?? `Roster ${side.roster_id}`}
                      size={28}
                    />
                    <div className="flex flex-col min-w-0">
                      <span title={side.roster?.username ?? `Roster ${side.roster_id}`} className="text-sm font-medium text-gray-100 truncate">
                        {side.roster?.username ?? `Roster ${side.roster_id}`}
                      </span>
                      {side.roster && (side.teamValue != null || side.teamRank != null) && (
                        <span className="text-[10px] text-gray-500 truncate">
                          {formatRecord(side.roster)}
                          {side.teamRank != null && (
                            <>
                              {" · "}
                              <span className="text-blue-400 font-semibold">
                                {formatValue(side.teamValue ?? 0)}
                              </span>
                              {" "}
                              {valueLabel} #{side.teamRank}/{totalTeams}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {lookup && (side.vReceiving > 0 || side.vGiving > 0) && (
                      <span className={`ml-auto text-xs font-semibold ${
                        side.vReceiving >= side.vGiving ? "text-green-400" : "text-red-400"
                      }`}>
                        {side.vReceiving >= side.vGiving ? "+" : ""}
                        {formatValue(side.vReceiving - side.vGiving)}
                      </span>
                    )}
                  </div>

                  <div className="px-4 pb-3 flex gap-3">
                    {side.receiving.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-green-500/70 font-semibold">Receives</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {side.receiving.map((item, j) => (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-xs text-green-300"
                            >
                              {item.position && (
                                <span className="text-[10px] text-green-500/60 font-semibold">{item.position}</span>
                              )}
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {side.giving.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-red-500/70 font-semibold">Sends</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {side.giving.map((item, j) => (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-300"
                            >
                              {item.position && (
                                <span className="text-[10px] text-red-500/60 font-semibold">{item.position}</span>
                              )}
                              {item.label}
                            </span>
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
              const tabs = ["Rosters", "DM", "League Chat", "Opponent"];
              const activeTab = expandedTab[trade.transaction_id] || "Rosters";
              return (
                <div className="border-t border-gray-700/40">
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
                    <>
                      {isCounter && (
                        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-600/30">
                          <span className="text-xs text-yellow-300">Click players or picks to add/remove from counter-offer</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 px-4 py-3">
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
                    </>
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
                </div>
              );
            })()}

            {/* Action buttons */}
            {isCounter ? (
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-700/40">
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
            ) : isReceived && (onAccept || onReject || onCounter) ? (
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-700/40">
                {onAccept && (
                  <button
                    onClick={() => setConfirmAction({ trade, action: "accept" })}
                    disabled={!!loadingAction}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-500 disabled:opacity-50"
                  >
                    {loadingAction === "accept" ? "Accepting..." : "Accept"}
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
                {onCounter && (
                  <button
                    onClick={() => enterCounter(trade, "counter")}
                    disabled={!!loadingAction}
                    className="rounded-md bg-gray-700 border border-gray-600 px-3 py-1 text-xs font-medium text-gray-200 transition hover:bg-gray-600 disabled:opacity-50"
                  >
                    Counter
                  </button>
                )}
                {error && (
                  <span className="text-xs text-red-400 ml-auto">{error}</span>
                )}
              </div>
            ) : !isReceived && (onWithdraw || onModify) ? (
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-700/40">
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
                  <span className="text-xs text-red-400 ml-auto">{error}</span>
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

