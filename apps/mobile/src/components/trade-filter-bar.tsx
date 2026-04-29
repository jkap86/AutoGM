import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native'
import {
  POSITION_FILTERS,
  VALUE_TYPES,
  type ThresholdFilter,
  type TradeValueFilter,
} from '../hooks/use-trade-value-filter'

const THRESHOLD_OPS = ['>=', '<=', '>', '<'] as const

export function TradeFilterBar({
  filter,
  countInfo,
}: {
  filter: TradeValueFilter
  countInfo?: { visible: number; total: number } | null
}) {
  const {
    valueType, setValueType,
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

  const [thresholdsOpen, setThresholdsOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const isAdp = valueType === 'adp' || valueType === 'auction'

  const hasThresholds =
    userValueFilter.value != null ||
    partnerValueFilter.value != null ||
    userRankFilter.value != null ||
    partnerRankFilter.value != null

  return (
    <View className="bg-gray-800 rounded-xl overflow-hidden mb-3">
      {/* Row 1: Value type + Position + Top N */}
      <View className="px-3 py-2">
        {/* Value type */}
        <View className="flex-row items-center gap-2 mb-2">
          <View className="flex-row bg-gray-900/60 rounded-lg p-0.5">
            {VALUE_TYPES.map((v) => (
              <TouchableOpacity key={v} onPress={() => setValueType(v)}
                className={`rounded-md px-3 py-1.5 ${valueType === v ? 'bg-blue-600' : ''}`}>
                <Text className={`text-[11px] font-semibold uppercase ${valueType === v ? 'text-white' : 'text-gray-500'}`}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {loading && <Text className="text-[10px] text-gray-500">Loading...</Text>}
          {isAdp && adpStats && !loading && (
            <Text className="text-[10px] text-gray-500">{adpStats.n_drafts.toLocaleString()} drafts</Text>
          )}
          {countInfo && countInfo.visible !== countInfo.total && (
            <Text className="text-[10px] text-gray-500 ml-auto">{countInfo.visible}/{countInfo.total}</Text>
          )}
        </View>

        {/* Position filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 }}>
          {POSITION_FILTERS.map((pos) => (
            <TouchableOpacity key={pos} onPress={() => setPositionFilter(pos)}
              className={`rounded-md px-2 py-1 ${positionFilter === pos ? 'bg-gray-600/80' : ''}`}>
              <Text className={`text-[11px] font-medium ${positionFilter === pos ? 'text-gray-100' : 'text-gray-500'}`}>
                {pos === 'PLAYERS+CUR' ? 'Plyr+Cur' : pos}
              </Text>
            </TouchableOpacity>
          ))}
          <View className="w-px h-5 bg-gray-700 self-center mx-1" />
          <TouchableOpacity onPress={() => setTopN(0)}
            className={`rounded-md px-2 py-1 ${topN === 0 ? 'bg-gray-600/80' : ''}`}>
            <Text className={`text-[11px] font-medium ${topN === 0 ? 'text-gray-100' : 'text-gray-500'}`}>All</Text>
          </TouchableOpacity>
          <TextInput
            keyboardType="number-pad"
            placeholder="Top N"
            placeholderTextColor="#4B5563"
            value={topN > 0 ? String(topN) : ''}
            onChangeText={(v) => setTopN(v === '' ? 0 : Math.max(0, Number(v)))}
            className="w-12 rounded-md bg-gray-900/60 border border-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300 text-center"
          />
        </ScrollView>
      </View>

      {/* Row 2: Source config (collapsible) */}
      <TouchableOpacity onPress={() => setSourceOpen(p => !p)}
        className="flex-row items-center justify-center py-1 border-t border-gray-700/60">
        <Text className="text-[10px] text-gray-500 font-semibold uppercase">
          {isAdp ? 'ADP Settings' : 'KTC Settings'} {sourceOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {sourceOpen && isAdp && (
        <View className="px-3 pb-2 gap-1.5">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="text-[10px] text-gray-500 font-semibold uppercase">From</Text>
            <TextInput value={adpFilters.startDate ?? ''} onChangeText={(v) => setAdpFilters((p: any) => ({ ...p, startDate: v || null }))}
              placeholder="YYYY-MM-DD" placeholderTextColor="#6B7280"
              className="bg-gray-900 rounded-md px-2 py-1 text-[11px] text-gray-300 border border-gray-700 w-[100px]" />
            <Text className="text-[10px] text-gray-500 font-semibold uppercase">To</Text>
            <TextInput value={adpFilters.endDate ?? ''} onChangeText={(v) => setAdpFilters((p: any) => ({ ...p, endDate: v || null }))}
              placeholder="YYYY-MM-DD" placeholderTextColor="#6B7280"
              className="bg-gray-900 rounded-md px-2 py-1 text-[11px] text-gray-300 border border-gray-700 w-[100px]" />
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[10px] text-gray-500 font-semibold uppercase">Type</Text>
            {['', 'snake', 'auction', 'linear'].map((t) => (
              <TouchableOpacity key={t} onPress={() => setAdpFilters((p: any) => ({ ...p, draftType: t || null }))}
                className={`px-2 py-1 rounded-md ${(adpFilters.draftType ?? '') === t ? 'bg-blue-600' : 'bg-gray-900'}`}>
                <Text className={`text-[11px] font-medium capitalize ${(adpFilters.draftType ?? '') === t ? 'text-white' : 'text-gray-500'}`}>
                  {t || 'Any'}
                </Text>
              </TouchableOpacity>
            ))}
            <Text className="text-[10px] text-gray-500 font-semibold uppercase ml-1">Min</Text>
            <TextInput value={String(adpFilters.minDrafts ?? 2)} keyboardType="number-pad"
              onChangeText={(v) => setAdpFilters((p: any) => ({ ...p, minDrafts: Math.max(1, Number(v) || 1) }))}
              className="bg-gray-900 rounded-md px-2 py-1 text-[11px] text-gray-300 border border-gray-700 w-10 text-center" />
          </View>
        </View>
      )}

      {/* Row 3: Thresholds (collapsible) */}
      <TouchableOpacity onPress={() => setThresholdsOpen(p => !p)}
        className="flex-row items-center justify-center py-1 border-t border-gray-700/60 gap-1">
        <Text className="text-[10px] text-gray-500 font-semibold uppercase">Thresholds</Text>
        {hasThresholds && <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        <Text className="text-[10px] text-gray-500">{thresholdsOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {thresholdsOpen && (
        <View className="px-3 pb-2 gap-1.5">
          <ThresholdInput label="Your Value" filter={userValueFilter} setFilter={setUserValueFilter} />
          <ThresholdInput label="Your Rank" filter={userRankFilter} setFilter={setUserRankFilter} />
          <ThresholdInput label="Ptr Value" filter={partnerValueFilter} setFilter={setPartnerValueFilter} />
          <ThresholdInput label="Ptr Rank" filter={partnerRankFilter} setFilter={setPartnerRankFilter} />
        </View>
      )}
    </View>
  )
}

function ThresholdInput({
  label,
  filter,
  setFilter,
}: {
  label: string
  filter: ThresholdFilter
  setFilter: (fn: (p: ThresholdFilter) => ThresholdFilter) => void
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-[10px] text-gray-500 font-semibold uppercase w-16">{label}</Text>
      <View className="flex-row gap-0.5">
        {THRESHOLD_OPS.map((op) => (
          <TouchableOpacity key={op} onPress={() => setFilter((p) => ({ ...p, op }))}
            className={`px-1.5 py-0.5 rounded ${filter.op === op ? 'bg-blue-600' : 'bg-gray-900'}`}>
            <Text className={`text-[11px] ${filter.op === op ? 'text-white' : 'text-gray-500'}`}>{op}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        keyboardType="number-pad"
        placeholder="--"
        placeholderTextColor="#4B5563"
        value={filter.value != null ? String(filter.value) : ''}
        onChangeText={(v) => setFilter((p) => ({ ...p, value: v === '' ? null : Number(v) }))}
        className="w-16 rounded-md bg-gray-900 border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300 text-center"
      />
    </View>
  )
}
