'use client'

import type React from 'react'
import {
  POSITION_FILTERS,
  VALUE_TYPES,
  type ThresholdFilter,
  type TradeValueFilter,
} from '../../hooks/use-trade-value-filter'

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
    adpStart, setAdpStart,
    adpEnd, setAdpEnd,
    positionFilter, setPositionFilter,
    topN, setTopN,
    userValueFilter, setUserValueFilter,
    partnerValueFilter, setPartnerValueFilter,
    userRankFilter, setUserRankFilter,
    partnerRankFilter, setPartnerRankFilter,
    today,
    loading,
  } = filter

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2.5 w-full max-w-4xl">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Value</span>
        {VALUE_TYPES.map((v) => (
          <button
            key={v}
            onClick={() => setValueType(v)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition uppercase ${
              valueType === v
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {v}
          </button>
        ))}
        {loading && <span className="text-[10px] text-gray-500 ml-2">Loading…</span>}
      </div>

      {valueType === 'ktc' ? (
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

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Pos</span>
        {POSITION_FILTERS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
              positionFilter === pos
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Top</span>
        <button
          onClick={() => setTopN(0)}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
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
          className="w-14 rounded bg-gray-700/60 border border-gray-600 px-2 py-0.5 text-[10px] text-gray-200 text-center focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap border-t border-gray-700/50 pt-2">
        <ThresholdInput label="Your Value" filter={userValueFilter} setFilter={setUserValueFilter} />
        <ThresholdInput label="Your Rank" filter={userRankFilter} setFilter={setUserRankFilter} />
        <ThresholdInput label="Ptr Value" filter={partnerValueFilter} setFilter={setPartnerValueFilter} />
        <ThresholdInput label="Ptr Rank" filter={partnerRankFilter} setFilter={setPartnerRankFilter} />
        {countInfo && countInfo.visible !== countInfo.total && (
          <span className="text-[10px] text-gray-500 ml-auto">
            Showing {countInfo.visible} of {countInfo.total}
          </span>
        )}
      </div>
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
      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
      <select
        value={filter.op}
        onChange={(e) => setFilter((p) => ({ ...p, op: e.target.value as ThresholdFilter['op'] }))}
        className="rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-[10px] text-gray-200"
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
        className="w-16 rounded bg-gray-700/60 border border-gray-600 px-2 py-0.5 text-[10px] text-gray-200 text-center focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}
