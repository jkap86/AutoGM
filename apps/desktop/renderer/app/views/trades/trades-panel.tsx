import { useCallback, useEffect, useState } from "react";
import type { LeagueDetailed, Allplayer, Message, GetDmByMembersResult, MessagesResult } from "@sleepier/shared";
import type { TradeWithLeague } from "../../../hooks/use-trades-by-status";
import { Avatar } from "../../components/avatar";
import { RosterColumn } from "../../components/roster-column";
import { getPickId } from "../../../lib/leagues";

export type TradeAction = (trade: TradeWithLeague) => Promise<void>;

function getPickKtcName(season: string, round: number, order: number | null): string {
  const suffix = round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th";
  if (order == null || order === 0) return `${season} Mid ${round}${suffix}`;
  const type = order <= 4 ? "Early" : order >= 9 ? "Late" : "Mid";
  return `${season} ${type} ${round}${suffix}`;
}

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

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
}: {
  trades: TradeWithLeague[];
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [player_id: string]: Allplayer };
  userId: string;
  resolveRoster: (league_id: string, roster_id: number) => import("../../../../main/lib/types").Roster | undefined;
  formatPick: (league_id: string, dp: { roster_id: number; season: string; round: number; previous_owner_id: number }) => string;
  formatTime: (epoch: number) => string;
  onAccept?: TradeAction;
  onReject?: TradeAction;
  onCounter?: (data: CounterOffer) => Promise<void>;
  onWithdraw?: TradeAction;
  onModify?: (data: CounterOffer) => Promise<void>;
  ktc?: Record<string, number>;
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

  return (
    <div className="flex flex-col gap-3">
      {trades.map((trade) => {
        const league = leagues[trade.league_id];
        const rosterIds = trade.roster_ids;
        const parsedPicks = (trade.draft_picks ?? []).map((s) => {
          const [roster_id, season, round, owner_id, previous_owner_id] = s.split(',');
          return { roster_id: +roster_id, season, round: +round, owner_id: +owner_id, previous_owner_id: +previous_owner_id };
        }).sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
        const userRid = league?.user_roster?.roster_id;
        const sortedRosterIds = [...rosterIds].sort((a, b) => (a === userRid ? -1 : b === userRid ? 1 : 0));
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
          const ktcReceiving = ktc
            ? receivingPids.reduce((sum, pid) => sum + (ktc[pid] ?? 0), 0)
              + receivingPickKtcNames.reduce((sum, name) => sum + (ktc[name] ?? 0), 0)
            : 0;
          const ktcGiving = ktc
            ? givingPids.reduce((sum, pid) => sum + (ktc[pid] ?? 0), 0)
              + givingPickKtcNames.reduce((sum, name) => sum + (ktc[name] ?? 0), 0)
            : 0;
          return { roster, roster_id: rid, receiving, giving, ktcReceiving, ktcGiving };
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
                <span className="text-sm font-medium text-gray-200">
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
                    <span className="text-sm font-medium text-gray-100 truncate">
                      {side.roster?.username ?? `Roster ${side.roster_id}`}
                    </span>
                    {ktc && (side.ktcReceiving > 0 || side.ktcGiving > 0) && (
                      <span className={`ml-auto text-xs font-semibold ${
                        side.ktcReceiving >= side.ktcGiving ? "text-green-400" : "text-red-400"
                      }`}>
                        {side.ktcReceiving >= side.ktcGiving ? "+" : ""}{side.ktcReceiving - side.ktcGiving} KTC
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
              const tabs = ["Rosters", "DM"];
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
                    onClick={() => handleAction(trade, "accept")}
                    disabled={!!loadingAction}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-500 disabled:opacity-50"
                  >
                    {loadingAction === "accept" ? "Accepting..." : "Accept"}
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={() => handleAction(trade, "reject")}
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
                    onClick={() => handleAction(trade, "withdraw")}
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
    </div>
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function deepParseJson(val: unknown): unknown {
  if (typeof val === "string") {
    try {
      return deepParseJson(JSON.parse(val));
    } catch {
      return val;
    }
  }
  if (Array.isArray(val)) return val.map(deepParseJson);
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = deepParseJson(v);
    }
    return out;
  }
  return val;
}

function parseAttachment(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  const parsed = deepParseJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  // Unwrap { data: { ... } } wrapper if present
  const obj = parsed as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

export function DmPanel({ userId, partnerId, partnerName, leagues }: { userId: string; partnerId: string; partnerName: string; leagues: { [league_id: string]: LeagueDetailed } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmId, setDmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dmResult = await window.ipc.invoke<GetDmByMembersResult>("graphql", {
        name: "getDmByMembers",
        vars: { members: [userId, partnerId] },
      });
      const id = dmResult.get_dm_by_members?.dm_id;
      setDmId(id ?? null);
      if (!id) {
        setMessages([]);
        setLoading(false);
        return;
      }
      const msgResult = await window.ipc.invoke<MessagesResult>("graphql", {
        name: "messages",
        vars: { parent_id: id },
      });
      setMessages(msgResult.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, partnerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !dmId || sending) return;
    setSending(true);
    setError(null);
    try {
      await window.ipc.invoke("graphql", {
        name: "createMessage",
        vars: {
          parent_id: dmId,
          text,
          k_attachment_data: [],
          v_attachment_data: [],
        },
      });
      setDraft("");
      await fetchMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [draft, dmId, sending, fetchMessages]);

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const sorted = [...messages].sort((a, b) => a.created - b.created);

  return (
    <div className="flex flex-col">
      {/* Messages area */}
      <div className="flex flex-col gap-1 px-4 py-3 max-h-72 overflow-y-auto flex-col-reverse">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <span className="text-xs text-gray-500">Loading DMs...</span>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={fetchMessages} className="text-xs text-gray-400 hover:text-gray-200 underline">Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <span className="text-xs text-gray-500">No DMs with {partnerName}</span>
          </div>
        ) : (
        <div className="flex flex-col gap-1">
        {sorted.map((msg) => {
          const isUser = msg.author_id === userId;
          const att = parseAttachment(msg.attachment);
          return (
            <div key={msg.message_id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-1.5 ${isUser ? "bg-blue-600/20" : "bg-gray-700/60"}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold ${isUser ? "text-blue-400" : "text-gray-300"}`}>
                    {msg.author_display_name}
                  </span>
                  <span className="text-[9px] text-gray-600">{formatTime(msg.created)}</span>
                </div>
                {msg.text && <p className="text-xs text-gray-200 whitespace-pre-wrap">{decodeHtmlEntities(msg.text)}</p>}
                {att && <AttachmentView attachment={att} leagues={leagues} />}
              </div>
            </div>
          );
        })}
        </div>
        )}
      </div>

      {/* Message input */}
      <div className="flex items-center gap-2 border-t border-gray-700/40 px-4 py-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={dmId ? `Message ${partnerName}...` : "Loading..."}
          disabled={!dmId || sending}
          className="flex-1 rounded bg-gray-900 border border-gray-700 px-2.5 py-1.5 text-xs text-gray-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || !dmId || sending}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      {error && messages.length > 0 && (
        <div className="px-4 pb-2">
          <span className="text-[10px] text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}

type PlayerAtt = { first_name?: string; last_name?: string; position?: string; team?: string; player_id?: string };
type PickAtt = { roster_id?: string; season?: string; round?: string; order?: number | string | null; owner_id?: string; previous_owner_id?: string; original_owner_id?: string };
type UserAtt = { display_name?: string; avatar?: string; user_id?: string };
type RosterTransaction = {
  adds?: PlayerAtt[];
  drops?: PlayerAtt[];
  added_picks?: PickAtt[];
  dropped_picks?: PickAtt[];
  user?: UserAtt;
};

function formatPickLabel(
  pk: PickAtt,
  ownerRid: string,
  usersMap: Record<string, UserAtt> | undefined,
  leagues: { [league_id: string]: LeagueDetailed } | undefined,
  leagueId: string | undefined,
) {
  // Try to find order from the league roster data
  let order: number | null = null;
  if (leagues && leagueId && pk.roster_id && pk.season && pk.round) {
    const league = leagues[leagueId];
    const rid = Number(pk.roster_id);
    const season = String(pk.season);
    const round = Number(pk.round);
    if (league) {
      for (const roster of league.rosters) {
        const match = roster.draftpicks.find(
          (dp) =>
            dp.roster_id === rid &&
            String(dp.season) === season &&
            dp.round === round,
        );
        if (match?.order != null) {
          order = match.order;
          break;
        }
      }
    }
  }

  if (order) {
    return `${pk.season} ${pk.round}.${String(order).padStart(2, "0")}`;
  }
  // No order — check if this is someone else's original pick
  const originalOwnerId = pk.original_owner_id;
  if (originalOwnerId && originalOwnerId !== ownerRid && usersMap) {
    const origUser = Object.values(usersMap).find((u) => u.user_id === originalOwnerId);
    if (origUser?.display_name) {
      return `${pk.season} Round ${pk.round} (${origUser.display_name})`;
    }
  }
  return `${pk.season} Round ${pk.round}`;
}

function AttachmentView({ attachment, leagues }: { attachment: Record<string, unknown>; leagues?: { [league_id: string]: LeagueDetailed } }) {
  // Trade DM attachment — has transactions_by_roster
  const txByRoster = attachment.transactions_by_roster as Record<string, RosterTransaction> | undefined;
  const usersMap = attachment.users_in_league_map as Record<string, UserAtt> | undefined;
  const leagueId = attachment.league_id as string | undefined;
  if (txByRoster) {
    return (
      <div className="mt-1 rounded bg-gray-800/60 px-2 py-1.5">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Trade Proposal</span>
        <div className="flex flex-col gap-2 mt-1">
          {Object.entries(txByRoster).map(([rid, side]) => {
            const name = side.user?.display_name ?? `Roster ${rid}`;
            const adds = side.adds ?? [];
            const drops = side.drops ?? [];
            const addedPicks = side.added_picks ?? [];
            const droppedPicks = side.dropped_picks ?? [];
            return (
              <div key={rid}>
                <span className="text-[10px] font-semibold text-gray-300">{name}</span>
                {adds.map((p, i) => (
                  <div key={`a${i}`} className="text-[11px] text-green-400 ml-2">
                    + {p.first_name} {p.last_name} <span className="text-green-600 text-[10px]">{p.position} - {p.team}</span>
                  </div>
                ))}
                {drops.map((p, i) => (
                  <div key={`d${i}`} className="text-[11px] text-red-400 ml-2">
                    − {p.first_name} {p.last_name} <span className="text-red-600 text-[10px]">{p.position} - {p.team}</span>
                  </div>
                ))}
                {addedPicks.map((pk, i) => (
                  <div key={`ap${i}`} className="text-[11px] text-blue-400 ml-2">
                    + {formatPickLabel(pk, rid, usersMap, leagues, leagueId)}
                  </div>
                ))}
                {droppedPicks.map((pk, i) => (
                  <div key={`dp${i}`} className="text-[11px] text-orange-400 ml-2">
                    − {formatPickLabel(pk, rid, usersMap, leagues, leagueId)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Poll attachment
  const prompt = attachment.prompt as string | undefined;
  if (prompt || attachment.poll_id) {
    const choices = attachment.choices as string[] | undefined;
    return (
      <div className="mt-1 rounded bg-gray-800/60 px-2 py-1.5">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Poll</span>
        {prompt && <p className="text-[11px] text-gray-200 mt-0.5">{prompt}</p>}
        {choices && (
          <div className="flex flex-col gap-0.5 mt-1">
            {choices.map((c, i) => (
              <span key={i} className="text-[11px] text-gray-400">• {c}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // GIF / Giphy attachment
  const gifUrl = (attachment.fixed_height_mp4 ?? attachment.fixed_height_small_mp4 ?? attachment.original_mp4) as string | undefined;
  const gifStill = (attachment.fixed_height_still ?? attachment.original_still) as string | undefined;
  if (gifUrl) {
    return (
      <div className="mt-1">
        <video
          src={gifUrl}
          autoPlay
          loop
          muted
          playsInline
          className="max-w-full max-h-40 rounded"
          poster={gifStill}
        />
      </div>
    );
  }

  // Image attachment
  const url = (attachment.url ?? attachment.image_url ?? attachment.original_still) as string | undefined;
  if (url) {
    return (
      <div className="mt-1">
        <img src={url} alt="attachment" className="max-w-full max-h-40 rounded" />
      </div>
    );
  }

  // Generic fallback
  const type = attachment.type as string | undefined;
  return (
    <div className="mt-1 rounded bg-gray-800/60 px-2 py-1.5">
      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">
        {type ?? "Attachment"}
      </span>
      <p className="text-[10px] text-gray-500 mt-0.5 break-all">
        {JSON.stringify(attachment, null, 0).slice(0, 200)}
      </p>
    </div>
  );
}
