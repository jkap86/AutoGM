"use client";

import { useMemo, useState } from "react";
import type { Allplayer } from "@sleepier/shared";
import { useAdp, type AdpFilters, type AdpRow } from "../../hooks/use-adp";

const ROSTER_SLOT_OPTIONS = [
  "QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "REC_FLEX",
  "WRRB_FLEX", "K", "DEF", "DL", "LB", "DB", "IDP_FLEX", "STARTER",
];

const SCORING_OPTIONS = [
  "pass_td", "pass_yd", "pass_int", "rush_td", "rush_yd",
  "rec", "rec_td", "rec_yd", "bonus_rec_te", "fum_lost",
];

const SETTINGS_OPTIONS = [
  "playoff_week_start", "trade_deadline", "total_rosters",
];

const OPERATORS = ["=", ">", "<"] as const;
const POSITION_FILTER_OPTIONS = ["ALL", "QB", "RB", "WR", "TE"] as const;
type PositionFilter = (typeof POSITION_FILTER_OPTIONS)[number];

export default function AdpView({
  allplayers,
}: {
  allplayers: { [id: string]: Allplayer };
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [filters, setFilters] = useState<AdpFilters>({
    startDate: defaultStart,
    endDate: today,
    draftType: null,
    leagueTypes: [0, 1, 2],
    bestBall: [0, 1],
    scoringFilters: [],
    settingsFilters: [],
    rosterSlotFilters: [],
    minDrafts: 2,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");

  const { data, stats, loading, error } = useAdp(filters);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const player = allplayers[row.player_id];
      if (!player) return false;
      if (positionFilter !== "ALL" && player.position !== positionFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = `${player.first_name} ${player.last_name}`.toLowerCase();
        if (!name.includes(s)) return false;
      }
      return true;
    });
  }, [data, allplayers, positionFilter, search]);

  const hasAuction = useMemo(() => data.some((r) => r.avg_pct != null), [data]);

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      {/* Header + filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">From</span>
          <input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value || null }))}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">To</span>
          <input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value || null }))}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Type</span>
          <select
            value={filters.draftType ?? ""}
            onChange={(e) =>
              setFilters((p) => ({ ...p, draftType: (e.target.value || null) as AdpFilters["draftType"] }))
            }
            className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
          >
            <option value="">Any</option>
            <option value="snake">Snake</option>
            <option value="auction">Auction</option>
            <option value="linear">Linear</option>
          </select>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Min drafts</span>
          <input
            type="number"
            min={1}
            value={filters.minDrafts ?? 2}
            onChange={(e) =>
              setFilters((p) => ({ ...p, minDrafts: Math.max(1, Number(e.target.value) || 1) }))
            }
            className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
          />
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="self-end rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition"
        >
          Advanced filters
          {(filters.scoringFilters?.length ?? 0) +
            (filters.settingsFilters?.length ?? 0) +
            (filters.rosterSlotFilters?.length ?? 0) >
            0 && (
            <span className="ml-1.5 text-blue-400">
              ({(filters.scoringFilters?.length ?? 0) +
                (filters.settingsFilters?.length ?? 0) +
                (filters.rosterSlotFilters?.length ?? 0)})
            </span>
          )}
        </button>

        <div className="ml-auto text-xs text-gray-500">
          {loading ? "Loading..." : `${stats.n_drafts} drafts · ${stats.n_leagues} leagues`}
        </div>
      </div>

      {/* Position filter + search */}
      <div className="flex items-center gap-2">
        {POSITION_FILTER_OPTIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              positionFilter === pos
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {pos}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Results table */}
      {error ? (
        <div className="rounded border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-800/80 text-gray-400">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Player</th>
                <th className="text-left px-3 py-2 font-semibold">Pos</th>
                <th className="text-left px-3 py-2 font-semibold">Team</th>
                <th className="text-right px-3 py-2 font-semibold">ADP</th>
                <th className="text-right px-3 py-2 font-semibold">Min</th>
                <th className="text-right px-3 py-2 font-semibold">Max</th>
                <th className="text-right px-3 py-2 font-semibold">Stdev</th>
                {hasAuction && (
                  <th className="text-right px-3 py-2 font-semibold">Auction %</th>
                )}
                <th className="text-right px-3 py-2 font-semibold">Drafts</th>
                {hasAuction && (
                  <th className="text-right px-3 py-2 font-semibold">Auctions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((row) => (
                <AdpRowItem key={row.player_id} row={row} allplayers={allplayers} hasAuction={hasAuction} />
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={hasAuction ? 10 : 8} className="text-center py-8 text-gray-500">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 500 && (
            <div className="px-3 py-2 text-center text-[10px] text-gray-500 bg-gray-800/40">
              Showing first 500 of {filtered.length} players
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <AdvancedFilterModal
          filters={filters}
          onSave={(f) => { setFilters(f); setModalOpen(false); }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function AdpRowItem({
  row,
  allplayers,
  hasAuction,
}: {
  row: AdpRow;
  allplayers: { [id: string]: Allplayer };
  hasAuction: boolean;
}) {
  const player = allplayers[row.player_id];
  if (!player) return null;
  return (
    <tr className="border-t border-gray-700/40 hover:bg-gray-800/40">
      <td className="px-3 py-1.5 text-gray-100">
        {player.first_name} {player.last_name}
      </td>
      <td className="px-3 py-1.5 text-gray-400">{player.position}</td>
      <td className="px-3 py-1.5 text-gray-400">{player.team || "—"}</td>
      <td className="px-3 py-1.5 text-right text-blue-400 font-semibold">
        {row.adp.toFixed(1)}
      </td>
      <td className="px-3 py-1.5 text-right text-gray-400">{row.min_pick}</td>
      <td className="px-3 py-1.5 text-right text-gray-400">{row.max_pick}</td>
      <td className="px-3 py-1.5 text-right text-gray-500">
        {row.stdev != null ? row.stdev.toFixed(1) : "—"}
      </td>
      {hasAuction && (
        <td className="px-3 py-1.5 text-right text-green-400">
          {row.avg_pct != null ? `${(row.avg_pct * 100).toFixed(1)}%` : "—"}
        </td>
      )}
      <td className="px-3 py-1.5 text-right text-gray-500">{row.n_drafts}</td>
      {hasAuction && (
        <td className="px-3 py-1.5 text-right text-gray-500">
          {row.n_auctions > 0 ? row.n_auctions : "—"}
        </td>
      )}
    </tr>
  );
}

function AdvancedFilterModal({
  filters,
  onSave,
  onClose,
}: {
  filters: AdpFilters;
  onSave: (f: AdpFilters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<AdpFilters>(filters);

  const leagueType1Opts = [
    { value: 0, label: "Redraft" },
    { value: 1, label: "Keeper" },
    { value: 2, label: "Dynasty" },
  ];
  const leagueType2Opts = [
    { value: 0, label: "Lineup" },
    { value: 1, label: "Best Ball" },
  ];

  const toggleType1 = (v: number) =>
    setLocal((p) => ({
      ...p,
      leagueTypes: p.leagueTypes?.includes(v)
        ? p.leagueTypes.filter((x) => x !== v)
        : [...(p.leagueTypes ?? []), v],
    }));

  const toggleType2 = (v: number) =>
    setLocal((p) => ({
      ...p,
      bestBall: p.bestBall?.includes(v)
        ? p.bestBall.filter((x) => x !== v)
        : [...(p.bestBall ?? []), v],
    }));

  const save = () => {
    const cleaned: AdpFilters = {
      ...local,
      scoringFilters: (local.scoringFilters ?? []).filter((s) => s.value != null),
      settingsFilters: (local.settingsFilters ?? []).filter((s) => s.value != null),
      rosterSlotFilters: (local.rosterSlotFilters ?? []).filter((s) => s.count != null),
    };
    onSave(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-6">Advanced ADP Filters</h2>

        <Section title="League Type">
          <div className="flex gap-2">
            {leagueType1Opts.map((opt) => (
              <ToggleBtn
                key={opt.value}
                label={opt.label}
                active={local.leagueTypes?.includes(opt.value) ?? false}
                onClick={() => toggleType1(opt.value)}
              />
            ))}
          </div>
        </Section>

        <Section title="Format">
          <div className="flex gap-2">
            {leagueType2Opts.map((opt) => (
              <ToggleBtn
                key={opt.value}
                label={opt.label}
                active={local.bestBall?.includes(opt.value) ?? false}
                onClick={() => toggleType2(opt.value)}
              />
            ))}
          </div>
        </Section>

        <Section title="Roster Slots">
          <DynamicRows
            rows={local.rosterSlotFilters ?? []}
            options={ROSTER_SLOT_OPTIONS}
            keyField="position"
            valueField="count"
            onChange={(rows) => setLocal((p) => ({ ...p, rosterSlotFilters: rows as AdpFilters["rosterSlotFilters"] }))}
          />
        </Section>

        <Section title="Scoring">
          <DynamicRows
            rows={local.scoringFilters ?? []}
            options={SCORING_OPTIONS}
            keyField="key"
            valueField="value"
            onChange={(rows) => setLocal((p) => ({ ...p, scoringFilters: rows as AdpFilters["scoringFilters"] }))}
          />
        </Section>

        <Section title="Settings">
          <DynamicRows
            rows={local.settingsFilters ?? []}
            options={SETTINGS_OPTIONS}
            keyField="key"
            valueField="value"
            onChange={(rows) => setLocal((p) => ({ ...p, settingsFilters: rows as AdpFilters["settingsFilters"] }))}
          />
        </Section>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function DynamicRows({
  rows,
  options,
  keyField,
  valueField,
  onChange,
}: {
  rows: { [k: string]: unknown }[];
  options: string[];
  keyField: string;
  valueField: string;
  onChange: (rows: { [k: string]: unknown }[]) => void;
}) {
  const addRow = () =>
    onChange([...rows, { [keyField]: options[0], operator: "=", [valueField]: null }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, value: unknown) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200"
            value={row[keyField] as string}
            onChange={(e) => updateRow(i, keyField, e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt.replaceAll("_", " ")}</option>
            ))}
          </select>
          <select
            className="w-14 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
            value={row.operator as string}
            onChange={(e) => updateRow(i, "operator", e.target.value)}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
            value={(row[valueField] as number) ?? ""}
            onChange={(e) =>
              updateRow(i, valueField, e.target.value === "" ? null : Number(e.target.value))
            }
          />
          <button
            onClick={() => removeRow(i)}
            className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/40 transition"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="self-start rounded border border-dashed border-gray-600 px-3 py-1 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition"
      >
        + Add
      </button>
    </div>
  );
}
