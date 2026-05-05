import { useState, type ReactNode } from "react";
import type { LeagueDetailed } from "@autogm/shared";
import { LeaguesPanel } from "./trades/leagues-panel";
import { LeagueChatsPanel } from "./trades/league-chats-panel";
import { VALUE_TYPES, type TradeValueFilter, type PositionFilter } from "../../hooks/use-trade-value-filter";
import type { AdpFilters } from "../../hooks/use-adp";

type LeaguesTab = "ranks" | "trades" | "waivers" | "chats";

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
  tradesView,
  waiversView,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  userId: string;
  filter: TradeValueFilter;
  tradesView?: ReactNode;
  waiversView?: ReactNode;
}) {
  const [tab, setTab] = useState<LeaguesTab>("ranks");
  const [topNByCategory, setTopNByCategory] = useState<Record<string, number>>({});

  const isAdp = filter.valueType === "adp" || filter.valueType === "auction";
  const [adpSettingsOpen, setAdpSettingsOpen] = useState(false);

  const adpSettingsActive =
    (filter.adpFilters.leagueTypes?.length ?? 0 > 0 ? (filter.adpFilters.leagueTypes!.length < 3 ? 1 : 0) : 0) +
    (filter.adpFilters.bestBall?.length ? 1 : 0) +
    (filter.adpFilters.rosterSlotFilters?.length ?? 0) +
    (filter.adpFilters.scoringFilters?.length ?? 0) +
    (filter.adpFilters.settingsFilters?.length ?? 0);

  const setTopNFor = (posFilter: string, value: number) => {
    setTopNByCategory((prev) => ({ ...prev, [posFilter]: value }));
  };

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-4">
      {/* Subtabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900/60 p-0.5">
        {(["ranks", "trades", "waivers", "chats"] as LeaguesTab[]).map((t) => (
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

      {/* Trades / Waivers — rendered without filter bar */}
      {tab === "trades" && tradesView}
      {tab === "waivers" && waiversView}

      {/* Filter bar — shown for ranks and chats */}
      {(tab === "ranks" || tab === "chats") && <div className="w-full max-w-4xl space-y-0">
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
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Draft</span>
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
            <button
              onClick={() => setAdpSettingsOpen((p) => !p)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                adpSettingsActive > 0
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-gray-700/60 bg-gray-900/60 text-gray-500 hover:text-gray-300"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Settings{adpSettingsActive > 0 ? ` (${adpSettingsActive})` : ""}
            </button>
          </div>
        )}

        {/* ADP league settings — inline expandable */}
        {isAdp && adpSettingsOpen && (
          <AdpSettingsPanel adpFilters={filter.adpFilters} setAdpFilters={filter.setAdpFilters} />
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
      </div>}

      {tab === "ranks" && (
        <LeaguesPanel
          leagues={leagues}
          userId={userId}
          filter={filter}
          topNByCategory={topNByCategory}
        />
      )}
      {tab === "chats" && (
        <LeagueChatsPanel
          leagues={leagues}
          userId={userId}
        />
      )}
    </div>
  );
}

// ── ADP League Settings Panel (inline, mirrors league filter) ────────

const ROSTER_SLOT_OPTIONS = [
  "QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "REC_FLEX",
  "WRRB_FLEX", "K", "DEF", "DL", "LB", "DB", "IDP_FLEX", "BN",
  "QB+SF", "STARTER",
];
const SCORING_OPTIONS = [
  "pass_td", "pass_yd", "pass_int", "rush_td", "rush_yd",
  "rec", "rec_td", "rec_yd", "bonus_rec_te", "fum_lost",
];
const SETTINGS_OPTIONS = [
  "league_average_match", "playoff_week_start", "trade_deadline",
  "disable_trades", "daily_waivers", "total_rosters",
];
const NUMERIC_SETTINGS = ["trade_deadline", "playoff_week_start", "total_rosters"];
const OPERATORS = ["=", ">", "<"] as const;

function AdpSettingsPanel({
  adpFilters,
  setAdpFilters,
}: {
  adpFilters: AdpFilters;
  setAdpFilters: (fn: (p: AdpFilters) => AdpFilters) => void;
}) {
  const leagueTypes = adpFilters.leagueTypes ?? [];
  const bestBall = adpFilters.bestBall ?? [];
  const rosterSlots = adpFilters.rosterSlotFilters ?? [];
  const scoring = adpFilters.scoringFilters ?? [];
  const settings = adpFilters.settingsFilters ?? [];

  const toggleLeagueType = (v: number) =>
    setAdpFilters((p) => {
      const cur = p.leagueTypes ?? [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...p, leagueTypes: next.length === 0 || next.length === 3 ? undefined : next };
    });

  const toggleBestBall = (v: number) =>
    setAdpFilters((p) => {
      const cur = p.bestBall ?? [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      return { ...p, bestBall: next.length === 0 || next.length === 2 ? undefined : next };
    });

  return (
    <div className="border-x border-gray-700/80 bg-gray-800/30 px-4 py-3 flex flex-col gap-4">
      {/* League Type */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">League Type</h4>
        <div className="flex gap-2">
          {([
            { value: 0, label: "Redraft" },
            { value: 1, label: "Keeper" },
            { value: 2, label: "Dynasty" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleLeagueType(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                leagueTypes.length === 0 || leagueTypes.includes(opt.value)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Format</h4>
        <div className="flex gap-2">
          {([
            { value: 0, label: "Lineup" },
            { value: 1, label: "Best Ball" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleBestBall(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                bestBall.length === 0 || bestBall.includes(opt.value)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Slots */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Roster Slots</h4>
        <DynamicRows
          rows={rosterSlots}
          options={ROSTER_SLOT_OPTIONS}
          keyField="position"
          valueField="count"
          onChange={(rows) => setAdpFilters((p) => ({ ...p, rosterSlotFilters: rows as AdpFilters["rosterSlotFilters"] }))}
        />
      </div>

      {/* Scoring */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Scoring</h4>
        <DynamicRows
          rows={scoring}
          options={SCORING_OPTIONS}
          keyField="key"
          valueField="value"
          onChange={(rows) => setAdpFilters((p) => ({ ...p, scoringFilters: rows as AdpFilters["scoringFilters"] }))}
        />
      </div>

      {/* Settings */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Settings</h4>
        <DynamicRows
          rows={settings}
          options={SETTINGS_OPTIONS}
          keyField="key"
          valueField="value"
          booleanKeys={SETTINGS_OPTIONS.filter((s) => !NUMERIC_SETTINGS.includes(s))}
          onChange={(rows) => setAdpFilters((p) => ({ ...p, settingsFilters: rows as AdpFilters["settingsFilters"] }))}
        />
      </div>

      {/* Clear all */}
      {(leagueTypes.length > 0 || bestBall.length > 0 || rosterSlots.length > 0 || scoring.length > 0 || settings.length > 0) && (
        <button
          onClick={() => setAdpFilters((p) => ({
            ...p,
            leagueTypes: undefined,
            bestBall: undefined,
            rosterSlotFilters: undefined,
            scoringFilters: undefined,
            settingsFilters: undefined,
          }))}
          className="self-start text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Clear all settings
        </button>
      )}
    </div>
  );
}

function DynamicRows({
  rows,
  options,
  keyField,
  valueField,
  booleanKeys,
  onChange,
}: {
  rows: Record<string, unknown>[];
  options: string[];
  keyField: string;
  valueField: string;
  booleanKeys?: string[];
  onChange: (rows: Record<string, unknown>[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const key = row[keyField] as string;
        const isBoolean = booleanKeys?.includes(key);
        return (
          <div key={i} className="flex items-center gap-2">
            <select
              className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200"
              value={key}
              onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [keyField]: e.target.value } : r)))}
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>{opt.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select
              className="w-14 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
              value={row.operator as string}
              onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, operator: e.target.value } : r)))}
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            {isBoolean ? (
              <div className="flex gap-1">
                <button
                  className={`rounded px-3 py-1 text-xs ${row[valueField] === 1 ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}
                  onClick={() => onChange(rows.map((r, idx) => (idx === i ? { ...r, [valueField]: 1 } : r)))}
                >Yes</button>
                <button
                  className={`rounded px-3 py-1 text-xs ${row[valueField] === 0 ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}
                  onClick={() => onChange(rows.map((r, idx) => (idx === i ? { ...r, [valueField]: 0 } : r)))}
                >No</button>
              </div>
            ) : (
              <input
                type="number"
                className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
                value={row[valueField] as number ?? ""}
                onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [valueField]: e.target.value === "" ? null : Number(e.target.value) } : r)))}
              />
            )}
            <button
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/40 transition"
            >
              &times;
            </button>
          </div>
        );
      })}
      <button
        onClick={() => onChange([...rows, { [keyField]: options[0], operator: "=", [valueField]: null }])}
        className="self-start rounded border border-dashed border-gray-600 px-3 py-1 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition"
      >
        + Add
      </button>
    </div>
  );
}
