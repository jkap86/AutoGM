import { useMemo, useState } from "react";
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
import { useKtcByDate } from "../../../hooks/use-ktc";
import { useAdp } from "../../../hooks/use-adp";

type PositionFilter = "ALL" | "PLAYERS" | "QB" | "RB" | "WR" | "TE" | "PICKS";
const POSITION_FILTERS: PositionFilter[] = ["ALL", "PLAYERS", "QB", "RB", "WR", "TE", "PICKS"];

type ValueType = "ktc" | "adp" | "auction";
const VALUE_TYPES: ValueType[] = ["ktc", "adp", "auction"];

function formatRecord(r: { wins: number; losses: number; ties: number }) {
  return r.ties > 0
    ? `${r.wins}-${r.losses}-${r.ties}`
    : `${r.wins}-${r.losses}`;
}

function getPickKtcName(season: string, round: number, order: number | null): string {
  const suffix = round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th";
  if (order == null || order === 0) return `${season} Mid ${round}${suffix}`;
  const type = order <= 4 ? "Early" : order >= 9 ? "Late" : "Mid";
  return `${season} ${type} ${round}${suffix}`;
}

// Exponential-decay draft-pick value curve. Converts a raw ADP pick number to a
// higher-is-better value so it can be summed and ranked like KTC/Auction.
// Pick 1 → 1000, Pick 10 → ~835, Pick 50 → 381, Pick 100 → 145, Pick 200 → 21.
function adpToValue(adp: number): number {
  return 1000 * Math.exp(-(adp - 1) / 50);
}

// Returns a sorted (desc) array of all values (players + picks) matching the filter.
function computeRosterValues(
  roster: Roster,
  filter: PositionFilter,
  valueLookup: Record<string, number>,
  allplayers: { [id: string]: Allplayer },
): number[] {
  const values: number[] = [];
  if (filter !== "PICKS") {
    for (const pid of roster.players ?? []) {
      const player = allplayers[pid];
      if (!player) continue;
      if (filter !== "ALL" && filter !== "PLAYERS" && player.position !== filter) continue;
      values.push(valueLookup[pid] ?? 0);
    }
  }
  if (filter === "ALL" || filter === "PICKS") {
    for (const pick of roster.draftpicks ?? []) {
      const name = getPickKtcName(pick.season, pick.round, pick.order);
      values.push(valueLookup[name] ?? 0);
    }
  }
  return values.sort((a, b) => b - a);
}

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
  ktc,
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
  ktc: Record<string, number>;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultAdpStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedTab, setExpandedTab] = useState<Record<string, string>>({});
  const [positionFilters, setPositionFilters] = useState<Record<string, PositionFilter>>({});
  const [topNFilters, setTopNFilters] = useState<Record<string, number>>({});

  // Value-type filter (global across all cards)
  const [valueType, setValueType] = useState<ValueType>("ktc");
  const [ktcDate, setKtcDate] = useState<string>(today);
  const [adpStart, setAdpStart] = useState<string>(defaultAdpStart);
  const [adpEnd, setAdpEnd] = useState<string>(today);

  const { ktc: ktcHistorical, loading: ktcLoading } = useKtcByDate(
    valueType === "ktc" && ktcDate !== today ? ktcDate : null,
  );
  const adpEnabled = valueType === "adp" || valueType === "auction";
  const { data: adpRows, loading: adpLoading } = useAdp(
    { startDate: adpStart, endDate: adpEnd, minDrafts: 2 },
    adpEnabled,
  );

  // Build a unified value lookup keyed by player_id OR pick name (KTC). Higher = better across all modes.
  // ADP is converted via exponential decay (adpToValue) so the 1→10 gap is weighted much more heavily than 101→110.
  const valueLookup = useMemo<Record<string, number>>(() => {
    if (valueType === "ktc") {
      return ktcDate !== today ? ktcHistorical : ktc;
    }
    const out: Record<string, number> = {};
    if (valueType === "adp") {
      for (const r of adpRows) out[r.player_id] = adpToValue(r.adp);
    } else if (valueType === "auction") {
      for (const r of adpRows) {
        if (r.avg_pct != null) out[r.player_id] = r.avg_pct * 100;
      }
    }
    return out;
  }, [valueType, ktcDate, today, ktc, ktcHistorical, adpRows]);

  const valueLabel = valueType === "ktc" ? "KTC" : valueType === "adp" ? "ADP" : "Auction";

  const toggleExpand = (key: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Pre-compute raw sorted player/pick values per roster per position (before top-N is applied)
  const rawByLeague = useMemo(() => {
    const result: Record<string, Record<PositionFilter, Record<number, number[]>>> = {};
    for (const league of filteredLeagues) {
      const perFilter = {} as Record<PositionFilter, Record<number, number[]>>;
      for (const filter of POSITION_FILTERS) {
        const perRoster: Record<number, number[]> = {};
        for (const r of league.rosters) {
          perRoster[r.roster_id] = computeRosterValues(r, filter, valueLookup, allplayers);
        }
        perFilter[filter] = perRoster;
      }
      result[league.league_id] = perFilter;
    }
    return result;
  }, [filteredLeagues, valueLookup, allplayers]);

  const sumTopN = (values: number[], topN: number) =>
    (topN > 0 ? values.slice(0, topN) : values).reduce((a, b) => a + b, 0);

  const cards = filteredLeagues.flatMap((league) =>
    league.tradingWith.map((partner) => ({ league, partner })),
  );

  if (cards.length === 0) {
    return (
      <p className="text-gray-400">
        No leagues match the selected players and picks.
      </p>
    );
  }

  const getValue = (leagueId: string, rosterId: number, filter: PositionFilter, topN: number) => {
    const values = rawByLeague[leagueId]?.[filter]?.[rosterId];
    if (!values) return 0;
    return sumTopN(values, topN);
  };

  const getRank = (leagueId: string, rosterId: number, filter: PositionFilter, topN: number) => {
    const perRoster = rawByLeague[leagueId]?.[filter];
    if (!perRoster) return null;
    const totals = Object.entries(perRoster).map(([rid, vals]) => ({
      rid: Number(rid),
      total: sumTopN(vals, topN),
    }));
    totals.sort((a, b) => b.total - a.total);
    return totals.findIndex((t) => t.rid === rosterId) + 1;
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Value-type filter bar */}
      <div className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Value</span>
          {VALUE_TYPES.map((v) => (
            <button
              key={v}
              onClick={() => setValueType(v)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition uppercase ${
                valueType === v
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {v}
            </button>
          ))}
          {(ktcLoading || adpLoading) && (
            <span className="text-[10px] text-gray-500 ml-2">Loading…</span>
          )}
        </div>
        {valueType === "ktc" ? (
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Date</span>
            <input
              type="date"
              value={ktcDate}
              max={today}
              onChange={(e) => setKtcDate(e.target.value || today)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] text-gray-200"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">From</span>
            <input
              type="date"
              value={adpStart}
              max={adpEnd}
              onChange={(e) => setAdpStart(e.target.value)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] text-gray-200"
            />
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">To</span>
            <input
              type="date"
              value={adpEnd}
              min={adpStart}
              max={today}
              onChange={(e) => setAdpEnd(e.target.value)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] text-gray-200"
            />
          </div>
        )}
      </div>

      <div className="grid w-full gap-4 grid-cols-1 xl:grid-cols-2">
        {cards.map(({ league, partner }) => {
          const cardKey = `${league.league_id}-${partner.roster_id}`;
          const isExpanded = expandedCards.has(cardKey);
          const typeLabel =
            league.settings.type === 2
              ? "Dynasty"
              : league.settings.type === 1
                ? "Keeper"
                : "Redraft";

          const positionFilter = positionFilters[cardKey] ?? "ALL";
          const topN = topNFilters[cardKey] ?? 0;
          const userValue = getValue(league.league_id, league.user_roster.roster_id, positionFilter, topN);
          const partnerValue = getValue(league.league_id, partner.roster_id, positionFilter, topN);
          const userRank = getRank(league.league_id, league.user_roster.roster_id, positionFilter, topN);
          const partnerRank = getRank(league.league_id, partner.roster_id, positionFilter, topN);
          const totalTeams = league.rosters.length;

          return (
            <div
              key={cardKey}
              className={`flex flex-col gap-2.5 rounded-lg border p-3.5 cursor-pointer transition ${
                selectedProposals.some(
                  (p) =>
                    p.league_id === league.league_id &&
                    p.user_id === partner.user_id,
                )
                  ? "border-yellow-500 bg-yellow-500/5 shadow-md shadow-yellow-500/10"
                  : "border-gray-700 bg-gray-800 hover:border-gray-600"
              }`}
              onClick={() =>
                setSelectedProposals((prev) => {
                  const exists = prev.some(
                    (p) =>
                      p.league_id === league.league_id &&
                      p.user_id === partner.user_id,
                  );
                  if (exists) {
                    return prev.filter(
                      (p) =>
                        !(
                          p.league_id === league.league_id &&
                          p.user_id === partner.user_id
                        ),
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        league_id: league.league_id,
                        user_id: partner.user_id,
                        k_adds: [...playersToGive, ...playersToReceive],
                        v_adds: [
                          ...playersToGive.map(() => partner.roster_id),
                          ...playersToReceive.map(
                            () => league.user_roster.roster_id,
                          ),
                        ],
                        k_drops: [...playersToGive, ...playersToReceive],
                        v_drops: [
                          ...playersToGive.map(
                            () => league.user_roster.roster_id,
                          ),
                          ...playersToReceive.map(() => partner.roster_id),
                        ],
                        draft_picks: [
                          ...picksToGive.flatMap((pickId) => {
                            const pick = league.user_roster.draftpicks.find(
                              (d) => getPickId(d) === pickId,
                            );
                            if (!pick) return [];
                            return [
                              `${pick.roster_id},${pick.season},${pick.round},${partner.roster_id},${league.user_roster.roster_id}`,
                            ];
                          }),
                          ...picksToReceive.flatMap((pickId) => {
                            const pick = partner.draftpicks.find(
                              (d) => getPickId(d) === pickId,
                            );
                            if (!pick) return [];
                            return [
                              `${pick.roster_id},${pick.season},${pick.round},${league.user_roster.roster_id},${partner.roster_id}`,
                            ];
                          }),
                        ],
                        waiver_budget: [],
                      },
                    ];
                  }
                })
              }
            >
              {/* League header */}
              <div className="flex items-center gap-2.5 border-b border-gray-700/50 pb-2.5">
                <Avatar hash={league.avatar} alt={league.name} size={32} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-gray-100">
                    {league.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {league.season} · {typeLabel} · {totalTeams} teams
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(cardKey);
                  }}
                  className="text-gray-500 hover:text-gray-300 transition"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {/* Filter toggles */}
              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Pos</span>
                  {POSITION_FILTERS.map((pos) => (
                    <button
                      key={pos}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPositionFilters((prev) => ({ ...prev, [cardKey]: pos }));
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                        positionFilter === pos
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Top</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTopNFilters((prev) => ({ ...prev, [cardKey]: 0 }));
                    }}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                      topN === 0
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                    }`}
                  >
                    All
                  </button>
                  <input
                    type="number"
                    min={1}
                    placeholder="N"
                    value={topN > 0 ? topN : ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const v = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
                      setTopNFilters((prev) => ({ ...prev, [cardKey]: v }));
                    }}
                    className="w-14 rounded bg-gray-700/60 border border-gray-600 px-2 py-0.5 text-[10px] text-gray-200 text-center focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Two-side comparison: user vs partner */}
              <div className="grid grid-cols-2 gap-2">
                <RosterSummary
                  label="You"
                  roster={league.user_roster}
                  record={formatRecord(league.user_roster)}
                  value={userValue}
                  rank={userRank}
                  totalTeams={totalTeams}
                  positionFilter={positionFilter}
                  topN={topN}
                  valueType={valueType}
                  valueLabel={valueLabel}
                />
                <RosterSummary
                  label={partner.username}
                  roster={partner}
                  record={formatRecord(partner)}
                  value={partnerValue}
                  rank={partnerRank}
                  totalTeams={totalTeams}
                  positionFilter={positionFilter}
                  topN={topN}
                  valueType={valueType}
                  valueLabel={valueLabel}
                />
              </div>

              {/* Expanded section with tabs */}
              {isExpanded && (() => {
                const tabs = ["Rosters", "DM"];
                const activeTab = expandedTab[cardKey] || "Rosters";
                return (
                  <div
                    className="border-t border-gray-700/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex px-1 border-b border-gray-700/40">
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
                      <div className="grid grid-cols-2 gap-3 pt-2.5">
                        <RosterColumn
                          roster={league.user_roster}
                          allplayers={allplayers}
                          label="Your Roster"
                          highlightIds={playersToGive}
                          highlightColor="red"
                          valueLookup={valueLookup}
                          formatValue={
                            valueType === "auction" ? (n) => `${n.toFixed(1)}%` : undefined
                          }
                        />
                        <RosterColumn
                          roster={partner}
                          allplayers={allplayers}
                          label={partner.username}
                          highlightIds={playersToReceive}
                          highlightColor="green"
                          valueLookup={valueLookup}
                          formatValue={
                            valueType === "auction" ? (n) => `${n.toFixed(1)}%` : undefined
                          }
                        />
                      </div>
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
    </div>
  );
}

function RosterSummary({
  label,
  roster,
  record,
  value,
  rank,
  totalTeams,
  positionFilter,
  topN,
  valueType,
  valueLabel,
}: {
  label: string;
  roster: Roster;
  record: string;
  value: number;
  rank: number | null;
  totalTeams: number;
  positionFilter: PositionFilter;
  topN: number;
  valueType: ValueType;
  valueLabel: string;
}) {
  const posLabel = topN > 0 ? `${positionFilter} Top ${topN}` : positionFilter;
  const valueDisplay =
    valueType === "auction"
      ? `${value.toFixed(1)}%`
      : Math.round(value).toLocaleString();
  return (
    <div className="flex items-center gap-2 rounded bg-gray-900/40 px-2 py-1.5">
      <Avatar hash={roster.avatar} alt={label} size={24} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate text-xs font-medium text-gray-100">{label}</span>
        <span className="text-[10px] text-gray-500">{record}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-xs font-semibold text-blue-400">{valueDisplay}</span>
        {rank != null && (
          <span className="text-[10px] text-gray-500">
            {valueLabel} · {posLabel}: #{rank}/{totalTeams}
          </span>
        )}
      </div>
    </div>
  );
}
