import { useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  Roster,
  ProposeTradeVars,
} from "@sleepier/shared";
import { getPickId } from "@sleepier/shared";
import { Avatar } from "../../components/avatar";
import { RosterColumn } from "../../components/roster-column";
import { DmPanel } from "./trades-panel";
import {
  getPickKtcName,
  passThreshold,
  type TradeValueFilter,
} from "../../../hooks/use-trade-value-filter";
import type { InterestByLeague } from "../../../hooks/use-league-players";
import { formatRecord } from "../../../lib/trade-utils";

type CardProposal = {
  playersToGive: string[];
  playersToReceive: string[];
  picksToGive: string[];
  picksToReceive: string[];
};

type CardField = keyof CardProposal;

export function PotentialTrades({
  playersToGive,
  playersToReceive,
  picksToGive,
  picksToReceive,
  filteredLeagues,
  selectedProposals,
  setSelectedProposals,
  allplayers,
  userId,
  leagues,
  filter,
  interestByLeague,
  tradeBlockByLeague,
}: {
  playersToGive: string[];
  playersToReceive: string[];
  picksToGive: string[];
  picksToReceive: string[];
  filteredLeagues: (LeagueDetailed & { tradingWith: Roster[] })[];
  selectedProposals: (ProposeTradeVars & { user_id: string })[];
  setSelectedProposals: React.Dispatch<
    React.SetStateAction<(ProposeTradeVars & { user_id: string })[]>
  >;
  allplayers: { [id: string]: Allplayer };
  userId: string;
  leagues: { [league_id: string]: LeagueDetailed };
  filter: TradeValueFilter;
  interestByLeague?: InterestByLeague;
  tradeBlockByLeague?: InterestByLeague;
}) {
  const {
    valueLookup,
    valueLabel,
    auctionFmt,
    formatValue,
    getValue,
    getRank,
    userValueFilter,
    partnerValueFilter,
    userRankFilter,
    partnerRankFilter,
  } = filter;

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedTab, setExpandedTab] = useState<Record<string, string>>({});

  // Per-card proposal overrides. When the user toggles an item inside a card's expanded view,
  // that card gets its own local proposal (initialized from the current globals). Cards without
  // an override track the global trade-builder state at the top of the page.
  const [cardOverrides, setCardOverrides] = useState<Record<string, CardProposal>>({});

  const globalProposal: CardProposal = {
    playersToGive,
    playersToReceive,
    picksToGive,
    picksToReceive,
  };

  const getEffective = (cardKey: string): CardProposal =>
    cardOverrides[cardKey] ?? globalProposal;

  const buildProposal = (
    league: LeagueDetailed,
    partner: Roster,
    p: CardProposal,
  ): ProposeTradeVars & { user_id: string; _effective: CardProposal } => ({
    league_id: league.league_id,
    user_id: partner.user_id,
    k_adds: [...p.playersToGive, ...p.playersToReceive],
    v_adds: [
      ...p.playersToGive.map(() => partner.roster_id),
      ...p.playersToReceive.map(() => league.user_roster.roster_id),
    ],
    k_drops: [...p.playersToGive, ...p.playersToReceive],
    v_drops: [
      ...p.playersToGive.map(() => league.user_roster.roster_id),
      ...p.playersToReceive.map(() => partner.roster_id),
    ],
    draft_picks: [
      ...p.picksToGive.flatMap((pickId) => {
        const pick = league.user_roster.draftpicks.find((d) => getPickId(d) === pickId);
        if (!pick) return [];
        return [`${pick.roster_id},${pick.season},${pick.round},${partner.roster_id},${league.user_roster.roster_id}`];
      }),
      ...p.picksToReceive.flatMap((pickId) => {
        const pick = partner.draftpicks.find((d) => getPickId(d) === pickId);
        if (!pick) return [];
        return [`${pick.roster_id},${pick.season},${pick.round},${league.user_roster.roster_id},${partner.roster_id}`];
      }),
    ],
    waiver_budget: [],
    _effective: p,
  });

  const toggleCardField = (
    cardKey: string,
    league: LeagueDetailed,
    partner: Roster,
    field: CardField,
    id: string,
  ) => {
    const current = cardOverrides[cardKey] ?? { ...globalProposal };
    const arr = current[field];
    const nextArr = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    const next: CardProposal = { ...current, [field]: nextArr };
    setCardOverrides((prev) => ({ ...prev, [cardKey]: next }));
    setSelectedProposals((prev) => {
      const idx = prev.findIndex(
        (p) => p.league_id === league.league_id && p.user_id === partner.user_id,
      );
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = buildProposal(league, partner, next);
      return updated;
    });
  };

  const toggleExpand = (key: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allCards = filteredLeagues.flatMap((league) =>
    league.tradingWith.map((partner) => {
      const userValue = getValue(league.league_id, league.user_roster.roster_id);
      const partnerValue = getValue(league.league_id, partner.roster_id);
      const userRank = getRank(league.league_id, league.user_roster.roster_id);
      const partnerRank = getRank(league.league_id, partner.roster_id);
      return { league, partner, userValue, partnerValue, userRank, partnerRank };
    }),
  );

  const visibleCards = allCards.filter(
    (c) =>
      passThreshold(c.userValue, userValueFilter) &&
      passThreshold(c.partnerValue, partnerValueFilter) &&
      passThreshold(c.userRank, userRankFilter) &&
      passThreshold(c.partnerRank, partnerRankFilter),
  );

  if (allCards.length === 0) {
    return (
      <p className="text-gray-400">
        No leagues match the selected players and picks.
      </p>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-3">
      {visibleCards.map(({ league, partner, userValue, partnerValue, userRank, partnerRank }) => {
        const cardKey = `${league.league_id}-${partner.roster_id}`;
        const isExpanded = expandedCards.has(cardKey);
        const typeLabel =
          league.settings.type === 2
            ? "Dynasty"
            : league.settings.type === 1
              ? "Keeper"
              : "Redraft";

        const totalTeams = league.rosters.length;
        const userRoster = league.user_roster;

        const effective = getEffective(cardKey);
        const isOverridden = cardKey in cardOverrides;

        type TradeItem = {
          type: "player" | "pick";
          label: string;
          position?: string;
          value: number;
          isTarget?: boolean; // receiving side has this player in their "likes"
          isOtb?: boolean; // sending side has this player on the trade block
          likersCount?: number;
        };
        const leagueInterest = interestByLeague?.[league.league_id];
        const leagueTB = tradeBlockByLeague?.[league.league_id];
        // Player item. `receivingRosterId` is the roster acquiring the player, `sendingRosterId`
        // is the roster giving the player away. Flag as "target" when the receiver has liked
        // the player, and as "otb" when the sender put the player on the trade block.
        const playerItem = (pid: string, receivingRosterId: number, sendingRosterId: number): TradeItem => {
          const likers = leagueInterest?.[pid] ?? [];
          const tbRosters = leagueTB?.[pid] ?? [];
          return {
            type: "player",
            label: allplayers[pid]?.full_name ?? pid,
            position: allplayers[pid]?.position,
            value: valueLookup[pid] ?? 0,
            isTarget: likers.includes(receivingRosterId),
            isOtb: tbRosters.includes(sendingRosterId),
            likersCount: likers.length,
          };
        };
        const pickItem = (pickId: string, source: typeof userRoster.draftpicks): TradeItem | null => {
          const pick = source.find((d) => getPickId(d) === pickId);
          if (!pick) return null;
          const ktcName = getPickKtcName(pick.season, pick.round, pick.order);
          return { type: "pick", label: getPickId(pick), value: valueLookup[ktcName] ?? 0 };
        };
        // Things moving from user → partner. Sender is user, receiver is partner.
        const userGiving: TradeItem[] = [
          ...effective.playersToGive.map((pid) => playerItem(pid, partner.roster_id, userRoster.roster_id)),
          ...effective.picksToGive.map((id) => pickItem(id, userRoster.draftpicks)).filter((x): x is TradeItem => x !== null),
        ];
        // Things moving from partner → user. Sender is partner, receiver is user.
        const userReceiving: TradeItem[] = [
          ...effective.playersToReceive.map((pid) => playerItem(pid, userRoster.roster_id, partner.roster_id)),
          ...effective.picksToReceive.map((id) => pickItem(id, partner.draftpicks)).filter((x): x is TradeItem => x !== null),
        ];
        const sumValues = (items: TradeItem[]) => items.reduce((s, it) => s + it.value, 0);

        const sides: Array<{
          isUser: boolean;
          roster: typeof partner;
          roster_id: number;
          value: number;
          rank: number | null;
          receiving: TradeItem[];
          giving: TradeItem[];
          delta: number;
        }> = [
          {
            isUser: true,
            roster: userRoster,
            roster_id: userRoster.roster_id,
            value: userValue,
            rank: userRank,
            receiving: userReceiving,
            giving: userGiving,
            delta: sumValues(userReceiving) - sumValues(userGiving),
          },
          {
            isUser: false,
            roster: partner,
            roster_id: partner.roster_id,
            value: partnerValue,
            rank: partnerRank,
            receiving: userGiving,
            giving: userReceiving,
            delta: sumValues(userGiving) - sumValues(userReceiving),
          },
        ];

        const isSelected = selectedProposals.some(
          (p) => p.league_id === league.league_id && p.user_id === partner.user_id,
        );
        const toggleSelect = () =>
          setSelectedProposals((prev) => {
            const exists = prev.some(
              (p) => p.league_id === league.league_id && p.user_id === partner.user_id,
            );
            if (exists) {
              return prev.filter(
                (p) => !(p.league_id === league.league_id && p.user_id === partner.user_id),
              );
            }
            return [...prev, buildProposal(league, partner, effective)];
          });

        return (
          <div
            key={cardKey}
            className={`rounded-xl border overflow-hidden transition cursor-pointer ${
              isSelected
                ? "border-yellow-500 bg-yellow-500/5 shadow-md shadow-yellow-500/10"
                : "border-gray-700/80 bg-gray-800/60 hover:border-gray-600/80"
            }`}
            onClick={toggleSelect}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar hash={league.avatar} alt={league.name} size={20} />
                <span title={league.name} className="text-sm font-medium text-gray-200 truncate">{league.name}</span>
                <span className="text-[11px] text-gray-500 truncate">
                  {league.season} · {typeLabel} · {totalTeams} teams
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(cardKey);
                }}
                className="text-gray-500 hover:text-gray-300 transition shrink-0"
                title={isExpanded ? "Collapse" : "Expand"}
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

            {/* Body: two sides */}
            <div className="flex items-stretch relative">
              {sides.map((side, i) => (
                <div key={side.roster_id} className="flex-1 flex flex-col min-w-0 relative">
                  {i > 0 && <div className="absolute inset-y-0 left-0 w-px bg-gray-700/50" />}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Avatar hash={side.roster.avatar} alt={side.roster.username} size={28} />
                    <div className="flex flex-col min-w-0">
                      <span title={side.isUser ? "You" : side.roster.username} className="text-sm font-medium text-gray-100 truncate">
                        {side.isUser ? "You" : side.roster.username}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {formatRecord(side.roster)}
                        {side.rank != null && (
                          <>
                            {" · "}
                            <span className="text-blue-400 font-semibold">{formatValue(side.value)}</span>
                            {" "}
                            {valueLabel} #{side.rank}/{totalTeams}
                          </>
                        )}
                      </span>
                    </div>
                    {side.delta !== 0 && (
                      <span
                        className={`ml-auto text-xs font-semibold ${
                          side.delta > 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {side.delta > 0 ? "+" : ""}
                        {formatValue(side.delta)}
                      </span>
                    )}
                  </div>

                  <div className="px-4 pb-3 flex gap-3 flex-wrap">
                    {side.receiving.length > 0 && (
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-green-500/70 font-semibold">Receives</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {side.receiving.map((item, j) => {
                            const hint = item.isTarget ? `Liked by this roster` : item.isOtb ? `On the trade block` : undefined;
                            return (
                              <span
                                key={j}
                                title={hint}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                                  item.isTarget
                                    ? "bg-pink-500/15 text-pink-200 ring-1 ring-pink-400/50"
                                    : item.isOtb
                                      ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/50"
                                      : "bg-green-500/10 text-green-300"
                                }`}
                              >
                                {item.position && (
                                  <span className={`text-[10px] font-semibold ${
                                    item.isTarget ? "text-pink-300/80" : item.isOtb ? "text-amber-300/80" : "text-green-500/60"
                                  }`}>
                                    {item.position}
                                  </span>
                                )}
                                <span title={item.label} className="truncate">{item.label}</span>
                                {item.isTarget && <span aria-hidden>♥</span>}
                                {item.isOtb && !item.isTarget && <span aria-hidden className="text-[10px]">OTB</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {side.giving.length > 0 && (
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-red-500/70 font-semibold">Sends</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {side.giving.map((item, j) => (
                            <span
                              key={j}
                              title={item.isOtb ? `On the trade block` : undefined}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                                item.isOtb
                                  ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/50"
                                  : "bg-red-500/10 text-red-300"
                              }`}
                            >
                              {item.position && (
                                <span className={`text-[10px] font-semibold ${item.isOtb ? "text-amber-300/80" : "text-red-500/60"}`}>{item.position}</span>
                              )}
                              <span title={item.label} className="truncate">{item.label}</span>
                              {item.isOtb && <span aria-hidden className="text-[10px]">OTB</span>}
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
            {isExpanded && (() => {
              const tabs = ["Rosters", "DM"];
              const activeTab = expandedTab[cardKey] || "Rosters";
              return (
                <div className="border-t border-gray-700/40" onClick={(e) => e.stopPropagation()}>
                  <div className="flex border-b border-gray-700/40 px-4">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTab((prev) => ({ ...prev, [cardKey]: tab }));
                        }}
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

                  {activeTab === "Rosters" && (
                    <>
                      <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-600/30 flex items-center justify-between">
                        <span className="text-xs text-yellow-300">
                          Click players or picks to add/remove from the proposal {isOverridden ? "(this league only)" : ""}
                        </span>
                        {isOverridden && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardOverrides((prev) => {
                                const { [cardKey]: _, ...rest } = prev;
                                return rest;
                              });
                              setSelectedProposals((prev) => {
                                const idx = prev.findIndex(
                                  (p) => p.league_id === league.league_id && p.user_id === partner.user_id,
                                );
                                if (idx === -1) return prev;
                                const updated = [...prev];
                                updated[idx] = buildProposal(league, partner, globalProposal);
                                return updated;
                              });
                            }}
                            className="text-[10px] text-yellow-200 hover:text-yellow-100 underline"
                          >
                            Reset to global
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 px-4 py-3">
                        <RosterColumn
                          roster={userRoster}
                          allplayers={allplayers}
                          label="Your Roster"
                          highlightIds={effective.playersToGive}
                          highlightPickIds={effective.picksToGive}
                          highlightColor="red"
                          valueLookup={valueLookup}
                          formatValue={auctionFmt}
                          onToggle={(id) => toggleCardField(cardKey, league, partner, "playersToGive", id)}
                          onTogglePick={(id) => toggleCardField(cardKey, league, partner, "picksToGive", id)}
                        />
                        <RosterColumn
                          roster={partner}
                          allplayers={allplayers}
                          label={partner.username}
                          highlightIds={effective.playersToReceive}
                          highlightPickIds={effective.picksToReceive}
                          highlightColor="green"
                          valueLookup={valueLookup}
                          formatValue={auctionFmt}
                          onToggle={(id) => toggleCardField(cardKey, league, partner, "playersToReceive", id)}
                          onTogglePick={(id) => toggleCardField(cardKey, league, partner, "picksToReceive", id)}
                        />
                      </div>
                    </>
                  )}

                  {activeTab === "DM" && (
                    <DmPanel
                      userId={userId}
                      partnerId={partner.user_id}
                      partnerName={partner.username}
                      leagues={leagues}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
