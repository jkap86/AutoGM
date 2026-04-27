import { useMemo, useState } from "react";
import type { LeagueDetailed } from "@autogm/shared";
import { Avatar } from "../../components/avatar";
import { formatRecord } from "../../../lib/trade-utils";
import type { PositionFilter, TradeValueFilter } from "../../../hooks/use-trade-value-filter";

const RANK_CATEGORIES: { label: string; filter: PositionFilter }[] = [
  { label: "Overall", filter: "ALL" },
  { label: "Players", filter: "PLAYERS" },
  { label: "QB", filter: "QB" },
  { label: "RB", filter: "RB" },
  { label: "WR", filter: "WR" },
  { label: "TE", filter: "TE" },
  { label: "Picks", filter: "PICKS" },
];

function rankColor(rank: number | null, total: number): string {
  if (rank === 1) return "text-yellow-400";
  if (rank != null && rank <= 3) return "text-green-400";
  if (rank != null && rank >= total - 2) return "text-red-400";
  return "text-gray-200";
}

export function LeaguesPanel({
  leagues,
  userId,
  filter,
  topNByCategory,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  userId: string;
  filter: TradeValueFilter;
  topNByCategory?: Record<string, number>;
}) {
  const { getValue, getRank, formatValue } = filter;
  const leagueList = Object.values(leagues);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<PositionFilter>("ALL");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleSort = (col: PositionFilter) => {
    if (sortCol === col) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  if (leagueList.length === 0) {
    return <p className="text-gray-400 text-center py-8">No leagues loaded.</p>;
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-3">
      {leagueList.map((league) => {
        const userRoster = league.user_roster;
        const totalTeams = league.rosters.length;
        const isExpanded = expandedId === league.league_id;
        const typeLabel =
          league.settings.type === 2
            ? "Dynasty"
            : league.settings.type === 1
              ? "Keeper"
              : "Redraft";

        return (
          <div
            key={league.league_id}
            className="rounded-xl border border-gray-700/80 bg-gray-800 overflow-hidden"
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-700/40 cursor-pointer hover:bg-gray-700/30 transition"
              onClick={() => toggleExpand(league.league_id)}
            >
              <Avatar hash={league.avatar} alt={league.name} size={24} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-200 truncate" title={league.name}>
                  {league.name}
                </span>
                <span className="text-xs text-gray-500">
                  {league.season} · {typeLabel} · {totalTeams} teams · {formatRecord(userRoster)}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* User rankings summary */}
            <div className="px-4 py-3">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${RANK_CATEGORIES.length}, minmax(0, 1fr))` }}>
                {RANK_CATEGORIES.map(({ label, filter: posFilter }) => {
                  const n = topNByCategory?.[posFilter] ?? 0;
                  const rank = getRank(league.league_id, userRoster.roster_id, posFilter, n || undefined);
                  const value = getValue(league.league_id, userRoster.roster_id, posFilter, n || undefined);

                  return (
                    <div
                      key={posFilter}
                      className="flex flex-col items-center rounded-lg bg-gray-900/60 px-2 py-2"
                    >
                      <span className="text-xs text-gray-500 font-medium">{label}</span>
                      <span className={`text-lg font-bold font-[family-name:var(--font-heading)] ${rankColor(rank, totalTeams)}`}>
                        {rank != null ? `#${rank}` : "���"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatValue(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expanded: all teams table */}
            {isExpanded && (
              <ExpandedTable
                league={league}
                userId={userId}
                getValue={getValue}
                getRank={getRank}
                formatValue={formatValue}
                sortCol={sortCol}
                sortAsc={sortAsc}
                onSort={handleSort}
                topNByCategory={topNByCategory}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpandedTable({
  league,
  userId,
  getValue,
  getRank,
  formatValue,
  sortCol,
  sortAsc,
  onSort,
  topNByCategory,
}: {
  league: LeagueDetailed;
  userId: string;
  getValue: (leagueId: string, rosterId: number, filter?: PositionFilter, n?: number) => number;
  getRank: (leagueId: string, rosterId: number, filter?: PositionFilter, n?: number) => number | null;
  formatValue: (n: number) => string;
  sortCol: PositionFilter;
  sortAsc: boolean;
  onSort: (col: PositionFilter) => void;
  topNByCategory?: Record<string, number>;
}) {
  const totalTeams = league.rosters.length;

  const rows = useMemo(() => {
    const data = league.rosters.map((roster) => {
      const values: Record<string, number> = {};
      const ranks: Record<string, number | null> = {};
      for (const { filter } of RANK_CATEGORIES) {
        const n = topNByCategory?.[filter] ?? 0;
        values[filter] = getValue(league.league_id, roster.roster_id, filter, n || undefined);
        ranks[filter] = getRank(league.league_id, roster.roster_id, filter, n || undefined);
      }
      return { roster, values, ranks };
    });

    data.sort((a, b) => {
      const av = a.values[sortCol] ?? 0;
      const bv = b.values[sortCol] ?? 0;
      return sortAsc ? av - bv : bv - av;
    });

    return data;
  }, [league, getValue, getRank, sortCol, sortAsc, topNByCategory]);

  return (
    <div className="border-t border-gray-700/40 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700/40">
            <th className="text-left px-3 py-2 text-gray-500 font-semibold">Team</th>
            <th className="text-left px-2 py-2 text-gray-500 font-semibold w-16">Record</th>
            {RANK_CATEGORIES.map(({ label, filter }) => (
              <th
                key={filter}
                className="text-center px-2 py-2 text-gray-500 font-semibold cursor-pointer hover:text-gray-300 transition select-none"
                onClick={() => onSort(filter)}
              >
                <span className="inline-flex items-center gap-0.5">
                  {label}
                  {sortCol === filter && (
                    <svg
                      className={`w-3 h-3 ${sortAsc ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ roster, values, ranks }) => {
            const isUser = roster.user_id === userId;
            return (
              <tr
                key={roster.roster_id}
                className={`border-b border-gray-700/20 ${isUser ? "bg-blue-600/10" : "hover:bg-gray-700/20"}`}
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 shrink-0 text-right font-semibold ${rankColor(ranks[sortCol], totalTeams)}`}>
                      {ranks[sortCol] != null ? `#${ranks[sortCol]}` : "—"}
                    </span>
                    <Avatar hash={roster.avatar} alt={roster.username} size={20} />
                    <span className={`truncate ${isUser ? "text-blue-300 font-medium" : "text-gray-300"}`}>
                      {roster.username}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-gray-400">
                  {formatRecord(roster)}
                </td>
                {RANK_CATEGORIES.map(({ filter }) => {
                  const rank = ranks[filter];
                  const value = values[filter];
                  return (
                    <td key={filter} className={`text-center px-2 py-1.5 ${rankColor(rank, totalTeams)}`}>
                      {formatValue(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
