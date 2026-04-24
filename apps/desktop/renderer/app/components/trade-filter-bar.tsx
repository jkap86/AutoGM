'use client'

import { useState } from 'react'
import type React from 'react'
import type { AdpFilters } from '../../hooks/use-adp'
import {
  POSITION_FILTERS,
  VALUE_TYPES,
  type ThresholdFilter,
  type TradeValueFilter,
} from '../../hooks/use-trade-value-filter'

const ROSTER_SLOT_OPTIONS = [
  'QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'REC_FLEX',
  'WRRB_FLEX', 'K', 'DEF', 'DL', 'LB', 'DB', 'IDP_FLEX', 'STARTER',
]
const SCORING_OPTIONS = [
  'pass_td', 'pass_yd', 'pass_int', 'rush_td', 'rush_yd',
  'rec', 'rec_td', 'rec_yd', 'bonus_rec_te', 'fum_lost',
]
const SETTINGS_OPTIONS = ['playoff_week_start', 'trade_deadline', 'total_rosters']
const OPERATORS = ['=', '>', '<'] as const

export function TradeFilterBar({
  filter,
  countInfo,
}: {
  filter: TradeValueFilter
  countInfo?: { visible: number; total: number } | null
}) {
  const {
    valueType, setValueType,
    ktcDate, setKtcDate,
    adpFilters, setAdpFilters,
    adpStats,
    positionFilter, setPositionFilter,
    topN, setTopN,
    userValueFilter, setUserValueFilter,
    partnerValueFilter, setPartnerValueFilter,
    userRankFilter, setUserRankFilter,
    partnerRankFilter, setPartnerRankFilter,
    today,
    loading,
  } = filter

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const isAdp = valueType === 'adp' || valueType === 'auction'

  const advancedCount =
    (adpFilters.scoringFilters?.length ?? 0) +
    (adpFilters.settingsFilters?.length ?? 0) +
    (adpFilters.rosterSlotFilters?.length ?? 0)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800 p-3 w-full max-w-4xl">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold mr-1">Value</span>
        {VALUE_TYPES.map((v) => (
          <button
            key={v}
            onClick={() => setValueType(v)}
            className={`rounded px-2 py-1 text-xs font-medium transition uppercase ${
              valueType === v
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {v}
          </button>
        ))}
        {loading && <span className="text-xs text-gray-500 ml-2">Loading…</span>}
        {isAdp && adpStats && !loading && (
          <span className="text-xs text-gray-500 ml-2">
            {adpStats.n_drafts} drafts · {adpStats.n_leagues} leagues
          </span>
        )}
      </div>

      {valueType === 'ktc' ? (
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Date</span>
          <input
            type="date"
            value={ktcDate}
            max={today}
            onChange={(e) => setKtcDate(e.target.value || today)}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">From</span>
            <input
              type="date"
              value={adpFilters.startDate ?? ''}
              max={adpFilters.endDate ?? today}
              onChange={(e) => setAdpFilters((p) => ({ ...p, startDate: e.target.value || null }))}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
            />
            <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">To</span>
            <input
              type="date"
              value={adpFilters.endDate ?? ''}
              min={adpFilters.startDate ?? undefined}
              max={today}
              onChange={(e) => setAdpFilters((p) => ({ ...p, endDate: e.target.value || null }))}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
            />
            <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Type</span>
            <select
              value={adpFilters.draftType ?? ''}
              onChange={(e) =>
                setAdpFilters((p) => ({ ...p, draftType: (e.target.value || null) as AdpFilters['draftType'] }))
              }
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
            >
              <option value="">Any</option>
              <option value="snake">Snake</option>
              <option value="auction">Auction</option>
              <option value="linear">Linear</option>
            </select>
            <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Min</span>
            <input
              type="number"
              min={1}
              value={adpFilters.minDrafts ?? 2}
              onChange={(e) =>
                setAdpFilters((p) => ({ ...p, minDrafts: Math.max(1, Number(e.target.value) || 1) }))
              }
              className="w-16 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 text-center"
            />
            <button
              onClick={() => setAdvancedOpen(true)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 transition"
            >
              Advanced{advancedCount > 0 && <span className="ml-1 text-blue-400">({advancedCount})</span>}
            </button>
          </div>
        </>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold mr-1">Pos</span>
        {POSITION_FILTERS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              positionFilter === pos
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {pos === 'PLAYERS+CUR' ? 'Players+Cur Picks' : pos}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold mr-1">Top</span>
        <button
          onClick={() => setTopN(0)}
          className={`rounded px-2 py-1 text-xs font-medium transition ${
            topN === 0
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          All
        </button>
        <input
          type="number"
          min={1}
          placeholder="N"
          value={topN > 0 ? topN : ''}
          onChange={(e) => {
            const v = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))
            setTopN(v)
          }}
          className="w-16 rounded bg-gray-700/60 border border-gray-600 px-2 py-1 text-xs text-gray-200 text-center focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap border-t border-gray-700/50 pt-2">
        <ThresholdInput label="Your Value" filter={userValueFilter} setFilter={setUserValueFilter} />
        <ThresholdInput label="Your Rank" filter={userRankFilter} setFilter={setUserRankFilter} />
        <ThresholdInput label="Ptr Value" filter={partnerValueFilter} setFilter={setPartnerValueFilter} />
        <ThresholdInput label="Ptr Rank" filter={partnerRankFilter} setFilter={setPartnerRankFilter} />
        {countInfo && countInfo.visible !== countInfo.total && (
          <span className="text-xs text-gray-500 ml-auto">
            Showing {countInfo.visible} of {countInfo.total}
          </span>
        )}
      </div>

      {advancedOpen && (
        <AdvancedFilterModal
          filters={adpFilters}
          onSave={(f) => { setAdpFilters(f); setAdvancedOpen(false) }}
          onClose={() => setAdvancedOpen(false)}
        />
      )}
    </div>
  )
}

function ThresholdInput({
  label,
  filter,
  setFilter,
}: {
  label: string
  filter: ThresholdFilter
  setFilter: React.Dispatch<React.SetStateAction<ThresholdFilter>>
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
      <select
        value={filter.op}
        onChange={(e) => setFilter((p) => ({ ...p, op: e.target.value as ThresholdFilter['op'] }))}
        className="rounded border border-gray-700 bg-gray-900 px-1 py-1 text-xs text-gray-200"
      >
        <option value=">=">&ge;</option>
        <option value="<=">&le;</option>
        <option value=">">&gt;</option>
        <option value="<">&lt;</option>
      </select>
      <input
        type="number"
        placeholder="—"
        value={filter.value ?? ''}
        onChange={(e) =>
          setFilter((p) => ({
            ...p,
            value: e.target.value === '' ? null : Number(e.target.value),
          }))
        }
        className="w-20 rounded bg-gray-700/60 border border-gray-600 px-2 py-1 text-xs text-gray-200 text-center focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}

// ---------- Advanced ADP Filter Modal (same as adp-view) ----------

function AdvancedFilterModal({
  filters,
  onSave,
  onClose,
}: {
  filters: AdpFilters
  onSave: (f: AdpFilters) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<AdpFilters>(filters)

  const leagueType1Opts = [
    { value: 0, label: 'Redraft' },
    { value: 1, label: 'Keeper' },
    { value: 2, label: 'Dynasty' },
  ]
  const leagueType2Opts = [
    { value: 0, label: 'Lineup' },
    { value: 1, label: 'Best Ball' },
  ]

  const toggleType1 = (v: number) =>
    setLocal((p) => ({
      ...p,
      leagueTypes: p.leagueTypes?.includes(v)
        ? p.leagueTypes.filter((x) => x !== v)
        : [...(p.leagueTypes ?? []), v],
    }))

  const toggleType2 = (v: number) =>
    setLocal((p) => ({
      ...p,
      bestBall: p.bestBall?.includes(v)
        ? p.bestBall.filter((x) => x !== v)
        : [...(p.bestBall ?? []), v],
    }))

  const save = () => {
    const cleaned: AdpFilters = {
      ...local,
      scoringFilters: (local.scoringFilters ?? []).filter((s) => s.value != null),
      settingsFilters: (local.settingsFilters ?? []).filter((s) => s.value != null),
      rosterSlotFilters: (local.rosterSlotFilters ?? []).filter((s) => s.count != null),
    }
    onSave(cleaned)
  }

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
            onChange={(rows) => setLocal((p) => ({ ...p, rosterSlotFilters: rows as AdpFilters['rosterSlotFilters'] }))}
          />
        </Section>

        <Section title="Scoring">
          <DynamicRows
            rows={local.scoringFilters ?? []}
            options={SCORING_OPTIONS}
            keyField="key"
            valueField="value"
            onChange={(rows) => setLocal((p) => ({ ...p, scoringFilters: rows as AdpFilters['scoringFilters'] }))}
          />
        </Section>

        <Section title="Settings">
          <DynamicRows
            rows={local.settingsFilters ?? []}
            options={SETTINGS_OPTIONS}
            keyField="key"
            valueField="value"
            onChange={(rows) => setLocal((p) => ({ ...p, settingsFilters: rows as AdpFilters['settingsFilters'] }))}
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
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function DynamicRows({
  rows,
  options,
  keyField,
  valueField,
  onChange,
}: {
  rows: { [k: string]: unknown }[]
  options: string[]
  keyField: string
  valueField: string
  onChange: (rows: { [k: string]: unknown }[]) => void
}) {
  const addRow = () =>
    onChange([...rows, { [keyField]: options[0], operator: '=', [valueField]: null }])
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const updateRow = (i: number, field: string, value: unknown) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))

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
              <option key={opt} value={opt}>{opt.replaceAll('_', ' ')}</option>
            ))}
          </select>
          <select
            className="w-14 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
            value={row.operator as string}
            onChange={(e) => updateRow(i, 'operator', e.target.value)}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 text-center"
            value={(row[valueField] as number) ?? ''}
            onChange={(e) =>
              updateRow(i, valueField, e.target.value === '' ? null : Number(e.target.value))
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
  )
}
