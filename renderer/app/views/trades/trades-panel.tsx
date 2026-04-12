import { useState } from "react";
import type { LeagueDetailed, Allplayer } from "../../../../main/lib/types";
import type { TradeWithLeague } from "../../../hooks/use-trades-by-status";
import { Avatar } from "../../components/avatar";
import { RosterColumn } from "../../components/roster-column";

export type TradeAction = (trade: TradeWithLeague) => Promise<void>;

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
  onCounter?: (trade: TradeWithLeague) => void;
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

  const formatTime = (epoch: number) => {
    const d = new Date(epoch * 1000);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return d.toLocaleDateString();
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
  onCounter?: (trade: TradeWithLeague) => void;
}) {
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleAction = async (trade: TradeWithLeague, action: "accept" | "reject") => {
    const fn = action === "accept" ? onAccept : onReject;
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

  return (
    <div className="flex flex-col gap-3">
      {trades.map((trade) => {
        const league = leagues[trade.league_id];
        const rosterIds = trade.roster_ids;
        const parsedPicks = (trade.draft_picks ?? []).map((s) => {
          const [roster_id, season, round, owner_id, previous_owner_id] = s.split(',');
          return { roster_id: +roster_id, season, round: +round, owner_id: +owner_id, previous_owner_id: +previous_owner_id };
        }).sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
        const sides = rosterIds.map((rid) => {
          const roster = resolveRoster(trade.league_id, rid);
          const receiving = [
            ...Object.entries(trade.adds ?? {})
              .filter(([, rId]) => rId === rid)
              .map(([pid]) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position })),
            ...parsedPicks
              .filter((dp) => dp.owner_id === rid)
              .map((dp) => ({ type: 'pick' as const, label: formatPick(trade.league_id, dp), position: undefined })),
          ];
          const giving = [
            ...Object.entries(trade.drops ?? {})
              .filter(([, rId]) => rId === rid)
              .map(([pid]) => ({ type: 'player' as const, label: allplayers[pid]?.full_name ?? pid, position: allplayers[pid]?.position })),
            ...parsedPicks
              .filter((dp) => dp.previous_owner_id === rid)
              .map((dp) => ({ type: 'pick' as const, label: formatPick(trade.league_id, dp), position: undefined })),
          ];
          return { roster, roster_id: rid, receiving, giving };
        });

        const isReceived = trade.creator !== userId;
        const loadingAction = actionLoading[trade.transaction_id];
        const error = actionError[trade.transaction_id];
        const isExpanded = expandedCards.has(trade.transaction_id);

        // Collect player IDs involved in the trade for highlighting
        const userRosterId = league?.user_roster?.roster_id;
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
                  {formatTime(trade.created)}
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

            {/* Expanded rosters */}
            {isExpanded && sides.length === 2 && sides[0].roster && sides[1].roster && (
              <div className="grid grid-cols-2 gap-3 px-4 py-3 border-t border-gray-700/40">
                <RosterColumn
                  roster={sides[0].roster}
                  allplayers={allplayers}
                  label={sides[0].roster.username}
                  highlightIds={sides[0].roster_id === userRosterId ? userDrops : userAdds}
                  highlightColor={sides[0].roster_id === userRosterId ? "red" : "green"}
                />
                <RosterColumn
                  roster={sides[1].roster}
                  allplayers={allplayers}
                  label={sides[1].roster.username}
                  highlightIds={sides[1].roster_id === userRosterId ? userDrops : userAdds}
                  highlightColor={sides[1].roster_id === userRosterId ? "red" : "green"}
                />
              </div>
            )}

            {/* Action buttons for received pending trades */}
            {isReceived && (onAccept || onReject || onCounter) && (
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
                    onClick={() => onCounter(trade)}
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
            )}
          </div>
        );
      })}
    </div>
  );
}
