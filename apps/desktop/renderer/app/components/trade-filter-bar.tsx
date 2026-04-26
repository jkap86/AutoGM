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
  const [thresholdsOpen, setThresholdsOpen] = useState(false)
  const isAdp = valueType === 'adp' || valueType === 'auction'

  const advancedCount =
    (adpFilters.scoringFilters?.length ?? 0) +
    (adpFilters.settingsFilters?.length ?? 0) +
    (adpFilters.rosterSlotFilters?.length ?? 0)

  const hasThresholds =
    userValueFilter.value != null ||
    partnerValueFilter.value != null ||
    userRankFilter.value != null ||
    partnerRankFilter.value != null

  return (
    <div className="w-full max-w-4xl space-y-0">
      {/* Primary row: Value type + Position + Top N — always visible */}
      <div className="flex items-center gap-4 rounded-t-xl border border-gray-700/80 bg-gray-850 bg-gradient-to-b from-gray-800 to-gray-800/80 px-4 py-2.5">
        {/* Value type segmented control */}
        <div className="flex items-center rounded-lg bg-gray-900/60 p-0.5">
          {VALUE_TYPES.map((v) => (
            <button
              key={v}
              onClick={() => setValueType(v)}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                valueType === v
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-700/60" />

        {/* Position filter pills */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {POSITION_FILTERS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                positionFilter === pos
                  ? 'bg-gray-600/80 text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40'
              }`}
            >
              {pos === 'PLAYERS+CUR' ? 'Plyr+Cur' : pos}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-700/60" />

        {/* Top N */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Top</span>
          <button
            onClick={() => setTopN(0)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              topN === 0
                ? 'bg-gray-600/80 text-gray-100'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All
          </button>
          <input
            type="number"
            min={1}
            placeholder="N"
            value={topN > 0 ? topN : ''}
            onChange={(e) => setTopN(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
            className="w-12 rounded-md bg-gray-900/60 border border-gray-700/60 px-1.5 py-1 text-[11px] text-gray-300 text-center placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition"
          />
        </div>

        {/* Loading / stats indicator */}
        {loading && (
          <span className="ml-auto text-[10px] text-gray-500 animate-pulse">Loading...</span>
        )}
        {isAdp && adpStats && !loading && (
          <span className="ml-auto text-[10px] text-gray-500">
            {adpStats.n_drafts.toLocaleString()} drafts
          </span>
        )}
        {countInfo && countInfo.visible !== countInfo.total && (
          <span className="ml-auto text-[10px] text-gray-500">
            {countInfo.visible}/{countInfo.total}
          </span>
        )}
      </div>

      {/* Secondary row: Source-specific config — collapsible feel */}
      <div className="flex items-center gap-3 border-x border-gray-700/80 bg-gray-800/50 px-4 py-2 flex-wrap">
        {valueType === 'ktc' ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Date</span>
            <input
              type="date"
              value={ktcDate}
              max={today}
              onChange={(e) => setKtcDate(e.target.value || today)}
              className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2.5 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
            />
            {ktcDate !== today && (
              <button
                onClick={() => setKtcDate(today)}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition"
              >
                Reset
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">From</span>
              <input
                type="date"
                value={adpFilters.startDate ?? ''}
                max={adpFilters.endDate ?? today}
                onChange={(e) => setAdpFilters((p) => ({ ...p, startDate: e.target.value || null }))}
                className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">To</span>
              <input
                type="date"
                value={adpFilters.endDate ?? ''}
                min={adpFilters.startDate ?? undefined}
                max={today}
                onChange={(e) => setAdpFilters((p) => ({ ...p, endDate: e.target.value || null }))}
                className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Type</span>
              <select
                value={adpFilters.draftType ?? ''}
                onChange={(e) =>
                  setAdpFilters((p) => ({ ...p, draftType: (e.target.value || null) as AdpFilters['draftType'] }))
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
                value={adpFilters.minDrafts ?? 2}
                onChange={(e) =>
                  setAdpFilters((p) => ({ ...p, minDrafts: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-12 rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 text-center focus:border-blue-500/50 focus:outline-none transition"
              />
            </div>
            <button
              onClick={() => setAdvancedOpen(true)}
              className="ml-auto flex items-center gap-1 rounded-md border border-gray-700/60 bg-gray-900/40 px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-200 hover:border-gray-600 transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Filters
              {advancedCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600/80 text-[9px] font-bold text-white">
                  {advancedCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Tertiary row: Threshold filters — expandable */}
      <div className="rounded-b-xl border border-t-0 border-gray-700/80 bg-gray-800/30 overflow-hidden">
        <button
          onClick={() => setThresholdsOpen(!thresholdsOpen)}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold hover:text-gray-400 transition"
        >
          <svg
            className={`w-3 h-3 transition-transform ${thresholdsOpen ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Thresholds
          {hasThresholds && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </button>

        {thresholdsOpen && (
          <div className="flex items-center gap-4 px-4 pb-2.5 pt-0.5 flex-wrap">
            <ThresholdInput label="Your Value" filter={userValueFilter} setFilter={setUserValueFilter} />
            <ThresholdInput label="Your Rank" filter={userRankFilter} setFilter={setUserRankFilter} />
            <ThresholdInput label="Ptr Value" filter={partnerValueFilter} setFilter={setPartnerValueFilter} />
            <ThresholdInput label="Ptr Rank" filter={partnerRankFilter} setFilter={setPartnerRankFilter} />
          </div>
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
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
      <select
        value={filter.op}
        onChange={(e) => setFilter((p) => ({ ...p, op: e.target.value as ThresholdFilter['op'] }))}
        className="rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
      >
        <option value=">=">&ge;</option>
        <option value="<=">&le;</option>
        <option value=">">&gt;</option>
        <option value="<">&lt;</option>
      </select>
      <input
        type="number"
        placeholder="--"
        value={filter.value ?? ''}
        onChange={(e) =>
          setFilter((p) => ({
            ...p,
            value: e.target.value === '' ? null : Number(e.target.value),
          }))
        }
        className="w-16 rounded-md bg-gray-900/60 border border-gray-700/60 px-2 py-0.5 text-[11px] text-gray-300 text-center placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition"
      />
    </div>
  )
}

// ---------- Advanced ADP Filter Modal ----------

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-700/80 bg-gray-900 p-6 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-100">Advanced Filters</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-700/60">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm shadow-blue-600/25 transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-blue-600/90 text-white shadow-sm shadow-blue-600/20'
          : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-750'
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
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className="flex-1 rounded-md border border-gray-700/60 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
            value={row[keyField] as string}
            onChange={(e) => updateRow(i, keyField, e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt.replaceAll('_', ' ')}</option>
            ))}
          </select>
          <select
            className="w-12 rounded-md border border-gray-700/60 bg-gray-800 px-1 py-1.5 text-[11px] text-gray-300 text-center focus:border-blue-500/50 focus:outline-none transition"
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
            className="w-16 rounded-md border border-gray-700/60 bg-gray-800 px-2 py-1.5 text-[11px] text-gray-300 text-center focus:border-blue-500/50 focus:outline-none transition"
            value={(row[valueField] as number) ?? ''}
            onChange={(e) =>
              updateRow(i, valueField, e.target.value === '' ? null : Number(e.target.value))
            }
          />
          <button
            onClick={() => removeRow(i)}
            className="rounded-md p-1 text-gray-600 hover:text-red-400 hover:bg-red-600/10 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="self-start flex items-center gap-1 rounded-md border border-dashed border-gray-700/60 px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-300 hover:border-gray-500 transition"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
    </div>
  )
}
