"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeagueDetailed } from "@sleepier/shared";

export type LeagueFilters = {
  leagueType1: number[];
  leagueType2: number[];
  rosterSlots: { position: string; operator: string; count: number | null }[];
  scoring: { key: string; operator: string; value: number | null }[];
  settings: { key: string; operator: string; value: number | null }[];
};

const DEFAULT_FILTERS: LeagueFilters = {
  leagueType1: [0, 1, 2],
  leagueType2: [0, 1],
  rosterSlots: [],
  scoring: [],
  settings: [],
};

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

function filterLeagues(
  leagues: Record<string, LeagueDetailed>,
  filters: LeagueFilters,
): Record<string, LeagueDetailed> {
  return Object.fromEntries(
    Object.entries(leagues).filter(([, league]) => {
      if (!filters.leagueType1.includes(league.settings.type)) return false;
      if (!filters.leagueType2.includes(league.settings.best_ball ?? 0)) return false;

      const slotOk = filters.rosterSlots.every((slot) => {
        const positions = league.roster_positions ?? [];
        const numPos = positions.filter((p) =>
          slot.position === "STARTER" ? p !== "BN" : slot.position === "QB+SF" ? p === "QB" || p === "SUPER_FLEX" : p === slot.position,
        ).length;
        return slot.operator === ">" ? numPos > (slot.count ?? 0)
          : slot.operator === "<" ? numPos < (slot.count ?? 0)
          : numPos === (slot.count ?? 0);
      });
      if (!slotOk) return false;

      const scoringOk = filters.scoring.every((s) => {
        const val = league.scoring_settings?.[s.key] ?? 0;
        return s.operator === ">" ? val > (s.value ?? 0)
          : s.operator === "<" ? val < (s.value ?? 0)
          : val === (s.value ?? 0);
      });
      if (!scoringOk) return false;

      const settingsOk = filters.settings.every((s) => {
        const val = (league.settings as Record<string, unknown>)[s.key] as number ?? 0;
        return s.operator === ">" ? val > (s.value ?? 0)
          : s.operator === "<" ? val < (s.value ?? 0)
          : val === (s.value ?? 0);
      });
      return settingsOk;
    }),
  );
}

export function useLeagueFilter(leagues: { [league_id: string]: LeagueDetailed } | null) {
  const [filters, setFilters] = useState<LeagueFilters>(DEFAULT_FILTERS);

  const filteredLeagues = useMemo(() => {
    if (!leagues) return {};
    return filterLeagues(leagues, filters);
  }, [leagues, filters]);

  const activeFilterCount =
    (filters.leagueType1.length < 3 ? 1 : 0) +
    (filters.leagueType2.length < 2 ? 1 : 0) +
    filters.rosterSlots.length +
    filters.scoring.length +
    filters.settings.length;

  return { filters, setFilters, filteredLeagues, activeFilterCount };
}

export function LeagueFilterBar({
  filters,
  setFilters,
  totalCount,
  filteredCount,
}: {
  filters: LeagueFilters;
  setFilters: (f: LeagueFilters) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const activeCount =
    (filters.leagueType1.length < 3 ? 1 : 0) +
    (filters.leagueType2.length < 2 ? 1 : 0) +
    filters.rosterSlots.length +
    filters.scoring.length +
    filters.settings.length;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          activeCount > 0
            ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
            : "border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filter{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <span className="text-sm text-gray-500">
        {filteredCount === totalCount
          ? `${totalCount} leagues`
          : `${filteredCount} of ${totalCount} leagues`}
      </span>
      {activeCount > 0 && (
        <button
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Clear all
        </button>
      )}

      {/* Summary chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.leagueType1.length < 3 && (
            <Chip label={`Type: ${filters.leagueType1.map((v) => ["Redraft", "Keeper", "Dynasty"][v]).join(", ")}`} />
          )}
          {filters.leagueType2.length < 2 && (
            <Chip label={`${filters.leagueType2.includes(1) ? "Best Ball" : "Lineup"}`} />
          )}
          {filters.rosterSlots.map((s, i) => (
            <Chip key={`rs${i}`} label={`${s.position} ${s.operator} ${s.count}`} />
          ))}
          {filters.scoring.map((s, i) => (
            <Chip key={`sc${i}`} label={`${s.key.replaceAll("_", " ")} ${s.operator} ${s.value}`} />
          ))}
          {filters.settings.map((s, i) => (
            <Chip key={`st${i}`} label={`${s.key.replaceAll("_", " ")} ${s.operator} ${NUMERIC_SETTINGS.includes(s.key) ? s.value : s.value === 1 ? "Yes" : "No"}`} />
          ))}
        </div>
      )}

      {modalOpen && (
        <FilterModal
          filters={filters}
          onSave={(f) => { setFilters(f); setModalOpen(false); }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded bg-blue-500/15 px-2.5 py-1 text-xs text-blue-400 font-medium">{label}</span>
  );
}

function FilterModal({
  filters,
  onSave,
  onClose,
}: {
  filters: LeagueFilters;
  onSave: (f: LeagueFilters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<LeagueFilters>(filters);

  useEffect(() => setLocal(filters), [filters]);

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
      leagueType1: p.leagueType1.includes(v)
        ? p.leagueType1.filter((x) => x !== v)
        : [...p.leagueType1, v],
    }));

  const toggleType2 = (v: number) =>
    setLocal((p) => ({
      ...p,
      leagueType2: p.leagueType2.includes(v)
        ? p.leagueType2.filter((x) => x !== v)
        : [...p.leagueType2, v],
    }));

  const save = () => {
    const cleaned: LeagueFilters = {
      ...local,
      rosterSlots: local.rosterSlots.filter((s) => s.count !== null),
      scoring: local.scoring.filter((s) => s.value !== null),
      settings: local.settings.filter((s) => s.value !== null),
    };
    onSave(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-6">League Filters</h2>

        {/* League Type */}
        <Section title="League Type">
          <div className="flex gap-2">
            {leagueType1Opts.map((opt) => (
              <ToggleBtn key={opt.value} label={opt.label} active={local.leagueType1.includes(opt.value)} onClick={() => toggleType1(opt.value)} />
            ))}
          </div>
        </Section>

        <Section title="Format">
          <div className="flex gap-2">
            {leagueType2Opts.map((opt) => (
              <ToggleBtn key={opt.value} label={opt.label} active={local.leagueType2.includes(opt.value)} onClick={() => toggleType2(opt.value)} />
            ))}
          </div>
        </Section>

        {/* Roster Slots */}
        <Section title="Roster Slots">
          <DynamicFilterRows
            rows={local.rosterSlots}
            options={ROSTER_SLOT_OPTIONS}
            keyField="position"
            valueField="count"
            onChange={(rows) => setLocal((p) => ({ ...p, rosterSlots: rows as LeagueFilters["rosterSlots"] }))}
          />
        </Section>

        {/* Scoring */}
        <Section title="Scoring">
          <DynamicFilterRows
            rows={local.scoring}
            options={SCORING_OPTIONS}
            keyField="key"
            valueField="value"
            onChange={(rows) => setLocal((p) => ({ ...p, scoring: rows as LeagueFilters["scoring"] }))}
          />
        </Section>

        {/* Settings */}
        <Section title="Settings">
          <DynamicFilterRows
            rows={local.settings}
            options={SETTINGS_OPTIONS}
            keyField="key"
            valueField="value"
            booleanKeys={SETTINGS_OPTIONS.filter((s) => !NUMERIC_SETTINGS.includes(s))}
            onChange={(rows) => setLocal((p) => ({ ...p, settings: rows as LeagueFilters["settings"] }))}
          />
        </Section>

        {/* Actions */}
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
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-800 text-gray-500 hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function DynamicFilterRows({
  rows,
  options,
  keyField,
  valueField,
  booleanKeys,
  onChange,
}: {
  rows: { [k: string]: unknown }[];
  options: string[];
  keyField: string;
  valueField: string;
  booleanKeys?: string[];
  onChange: (rows: { [k: string]: unknown }[]) => void;
}) {
  const addRow = () => {
    onChange([...rows, { [keyField]: options[0], operator: "=", [valueField]: null }]);
  };

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
  };

  const updateRow = (i: number, field: string, value: unknown) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

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
              onChange={(e) => updateRow(i, keyField, e.target.value)}
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replaceAll("_", " ")}
                </option>
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
            {isBoolean ? (
              <div className="flex gap-1">
                <button
                  className={`rounded px-3 py-1 text-xs ${row[valueField] === 1 ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}
                  onClick={() => updateRow(i, valueField, 1)}
                >Yes</button>
                <button
                  className={`rounded px-3 py-1 text-xs ${row[valueField] === 0 ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}
                  onClick={() => updateRow(i, valueField, 0)}
                >No</button>
              </div>
            ) : (
              <input
                type="number"
                className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
                value={row[valueField] as number ?? ""}
                onChange={(e) =>
                  updateRow(i, valueField, e.target.value === "" ? null : Number(e.target.value))
                }
              />
            )}
            <button
              onClick={() => removeRow(i)}
              className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/40 transition"
            >
              ✕
            </button>
          </div>
        );
      })}
      <button
        onClick={addRow}
        className="self-start rounded border border-dashed border-gray-600 px-3 py-1 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition"
      >
        + Add
      </button>
    </div>
  );
}
