import { useState } from "react";
import type { LeagueDetailed } from "@autogm/shared";
import { LeaguesPanel } from "./trades/leagues-panel";
import { LeagueChatsPanel } from "./trades/league-chats-panel";
import { VALUE_TYPES, type TradeValueFilter, type PositionFilter } from "../../hooks/use-trade-value-filter";
import type { AdpFilters } from "../../hooks/use-adp";

type LeaguesTab = "ranks" | "chats";

const RANK_LABELS: Record<string, string> = {
  ALL: "Overall",
  PLAYERS: "Players",
  "PLAYERS+CUR": "Plyr+Cur",
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  PICKS: "Picks",
};

export default function LeaguesView({
  leagues,
  userId,
  filter,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  userId: string;
  filter: TradeValueFilter;
}) {
  const [tab, setTab] = useState<LeaguesTab>("ranks");
  const [topNByCategory, setTopNByCategory] = useState<Record<string, number>>({});

  const isAdp = filter.valueType === "adp" || filter.valueType === "auction";

  const setTopNFor = (posFilter: string, value: number) => {
    setTopNByCategory((prev) => ({ ...prev, [posFilter]: value }));
  };

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-4">
      {/* Subtabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900/60 p-0.5">
        {(["ranks", "chats"] as LeaguesTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              tab === t
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filter bar — shared between ranks and chats */}
      <div className="w-full max-w-4xl space-y-0">
        {/* Value type selector */}
        <div className="flex items-center justify-center gap-3 flex-wrap rounded-t-xl border border-gray-700/80 bg-gradient-to-b from-gray-800 to-gray-800/80 px-4 py-2.5">
          <div className="flex items-center gap-2 rounded-lg bg-gray-900/60 p-0.5">
            {VALUE_TYPES.map((v) => (
              <button
                key={v}
                onClick={() => filter.setValueType(v)}
                className={`rounded-md px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  filter.valueType === v
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {filter.loading && <span className="text-[10px] text-gray-500 animate-pulse">Loading...</span>}
          {isAdp && filter.adpStats && !filter.loading && (
            <span className="text-[10px] text-gray-500">
              {filter.adpStats.n_drafts.toLocaleString()} drafts
            </span>
          )}
        </div>

        {/* ADP/Auction filters row */}
        {isAdp && (
          <div className="flex items-center justify-center gap-3 border-x border-gray-700/80 bg-gray-800/50 px-4 py-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">From</span>
              <input
                type="date"
                value={filter.adpFilters.startDate ?? ""}
                max={filter.adpFilters.endDate ?? filter.today}
                onChange={(e) => filter.setAdpFilters((p: AdpFilters) => ({ ...p, startDate: e.target.value || null }))}
                className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">To</span>
              <input
                type="date"
                value={filter.adpFilters.endDate ?? ""}
                min={filter.adpFilters.startDate ?? undefined}
                max={filter.today}
                onChange={(e) => filter.setAdpFilters((p: AdpFilters) => ({ ...p, endDate: e.target.value || null }))}
                className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Type</span>
              <select
                value={filter.adpFilters.draftType ?? ""}
                onChange={(e) =>
                  filter.setAdpFilters((p: AdpFilters) => ({ ...p, draftType: (e.target.value || null) as AdpFilters["draftType"] }))
                }
                className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
              >
                <option value="">Any</option>
                <option value="snake">Snake</option>
                <option value="auction">Auction</option>
                <option value="linear">Linear</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Min</span>
              <input
                type="number"
                min={1}
                value={filter.adpFilters.minDrafts ?? 2}
                onChange={(e) =>
                  filter.setAdpFilters((p: AdpFilters) => ({ ...p, minDrafts: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-12 rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 text-center focus:border-blue-500/50 focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {/* KTC date picker */}
        {filter.valueType === "ktc" && (
          <div className="flex items-center justify-center gap-2 border-x border-gray-700/80 bg-gray-800/50 px-4 py-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Date</span>
            <input
              type="date"
              value={filter.ktcDate}
              max={filter.today}
              onChange={(e) => filter.setKtcDate(e.target.value || filter.today)}
              className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2.5 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
            />
            {filter.ktcDate !== filter.today && (
              <button
                onClick={() => filter.setKtcDate(filter.today)}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* Per-category Top N — league card style */}
        {tab === "ranks" && (
          <div className="rounded-b-xl border border-t-0 border-gray-700/80 bg-gray-800/30 px-4 py-3">
            <span className="block text-center text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Rank by best __ players</span>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Object.keys(RANK_LABELS).length - 1}, minmax(0, 1fr))` }}>
              {(["ALL", "PLAYERS", "QB", "RB", "WR", "TE", "PICKS"] as PositionFilter[]).map((pos) => (
                <div
                  key={pos}
                  className="flex flex-col items-center rounded-lg bg-gray-900/60 px-2 py-2"
                >
                  <span className="text-[10px] text-gray-500 font-medium">{RANK_LABELS[pos] ?? pos}</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="All"
                    value={topNByCategory[pos] || ""}
                    onChange={(e) => setTopNFor(pos, e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                    className="w-12 mt-1 rounded-md bg-gray-800 border border-gray-700/60 px-1 py-1 text-sm text-gray-200 text-center font-bold font-[family-name:var(--font-heading)] placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close the filter bar with rounded bottom when on chats tab */}
        {tab === "chats" && (
          <div className="h-0 rounded-b-xl border-x border-b border-gray-700/80" />
        )}
      </div>

      {tab === "ranks" ? (
        <LeaguesPanel
          leagues={leagues}
          userId={userId}
          filter={filter}
          topNByCategory={topNByCategory}
        />
      ) : (
        <LeagueChatsPanel
          leagues={leagues}
          userId={userId}
        />
      )}
    </div>
  );
}
