import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native'
import type { LeagueDetailed } from '@autogm/shared'

export type LeagueFilters = {
  leagueType1: number[]
  leagueType2: number[]
  rosterSlots: { position: string; operator: string; count: number | null }[]
  scoring: { key: string; operator: string; value: number | null }[]
  settings: { key: string; operator: string; value: number | null }[]
}

const DEFAULT_FILTERS: LeagueFilters = {
  leagueType1: [0, 1, 2],
  leagueType2: [0, 1],
  rosterSlots: [],
  scoring: [],
  settings: [],
}

const ROSTER_SLOT_OPTIONS = [
  'QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'REC_FLEX',
  'WRRB_FLEX', 'K', 'DEF', 'DL', 'LB', 'DB', 'IDP_FLEX', 'BN',
  'QB+SF', 'STARTER',
]

const SCORING_OPTIONS = [
  'pass_td', 'pass_yd', 'pass_int', 'rush_td', 'rush_yd',
  'rec', 'rec_td', 'rec_yd', 'bonus_rec_te', 'fum_lost',
]

const SETTINGS_OPTIONS = [
  'league_average_match', 'playoff_week_start', 'trade_deadline',
  'disable_trades', 'daily_waivers', 'total_rosters',
]

const NUMERIC_SETTINGS = ['trade_deadline', 'playoff_week_start', 'total_rosters']
const OPERATORS = ['=', '>', '<'] as const

function filterLeagues(
  leagues: Record<string, LeagueDetailed>,
  filters: LeagueFilters,
): Record<string, LeagueDetailed> {
  return Object.fromEntries(
    Object.entries(leagues).filter(([, league]) => {
      if (!filters.leagueType1.includes(league.settings.type)) return false
      if (!filters.leagueType2.includes(league.settings.best_ball ?? 0)) return false

      const slotOk = filters.rosterSlots.every((slot) => {
        const positions = league.roster_positions ?? []
        const numPos = positions.filter((p) =>
          slot.position === 'STARTER' ? p !== 'BN' : slot.position === 'QB+SF' ? p === 'QB' || p === 'SUPER_FLEX' : p === slot.position,
        ).length
        return slot.operator === '>' ? numPos > (slot.count ?? 0)
          : slot.operator === '<' ? numPos < (slot.count ?? 0)
          : numPos === (slot.count ?? 0)
      })
      if (!slotOk) return false

      const scoringOk = filters.scoring.every((s) => {
        const val = league.scoring_settings?.[s.key] ?? 0
        return s.operator === '>' ? val > (s.value ?? 0)
          : s.operator === '<' ? val < (s.value ?? 0)
          : val === (s.value ?? 0)
      })
      if (!scoringOk) return false

      const settingsOk = filters.settings.every((s) => {
        const val = (league.settings as Record<string, unknown>)[s.key] as number ?? 0
        return s.operator === '>' ? val > (s.value ?? 0)
          : s.operator === '<' ? val < (s.value ?? 0)
          : val === (s.value ?? 0)
      })
      return settingsOk
    }),
  )
}

export function useLeagueFilter(leagues: { [league_id: string]: LeagueDetailed } | null) {
  const [filters, setFilters] = useState<LeagueFilters>(DEFAULT_FILTERS)

  const filteredLeagues = useMemo(() => {
    if (!leagues) return {}
    return filterLeagues(leagues, filters)
  }, [leagues, filters])

  const activeFilterCount =
    (filters.leagueType1.length < 3 ? 1 : 0) +
    (filters.leagueType2.length < 2 ? 1 : 0) +
    filters.rosterSlots.length +
    filters.scoring.length +
    filters.settings.length

  return { filters, setFilters, filteredLeagues, activeFilterCount }
}

export function LeagueFilterBar({
  filters,
  setFilters,
  totalCount,
  filteredCount,
}: {
  filters: LeagueFilters
  setFilters: (f: LeagueFilters) => void
  totalCount: number
  filteredCount: number
}) {
  const [modalOpen, setModalOpen] = useState(false)

  const activeCount =
    (filters.leagueType1.length < 3 ? 1 : 0) +
    (filters.leagueType2.length < 2 ? 1 : 0) +
    filters.rosterSlots.length +
    filters.scoring.length +
    filters.settings.length

  return (
    <View className="flex-row items-center gap-2 flex-wrap px-3 py-2">
      <TouchableOpacity
        onPress={() => setModalOpen(true)}
        className={`flex-row items-center gap-1 rounded-lg border px-3 py-1.5 ${
          activeCount > 0
            ? 'border-blue-500/50 bg-blue-500/10'
            : 'border-gray-700 bg-gray-800'
        }`}
      >
        <Text className={`text-xs font-medium ${activeCount > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
          Filter{activeCount > 0 ? ` (${activeCount})` : ''}
        </Text>
      </TouchableOpacity>

      <Text className="text-xs text-gray-500">
        {filteredCount === totalCount
          ? `${totalCount} leagues`
          : `${filteredCount} of ${totalCount}`}
      </Text>

      {activeCount > 0 && (
        <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)}>
          <Text className="text-xs text-gray-500 underline">Clear</Text>
        </TouchableOpacity>
      )}

      {/* Summary chips */}
      {activeCount > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {filters.leagueType1.length < 3 && (
            <Chip label={`Type: ${filters.leagueType1.map((v) => ['Redraft', 'Keeper', 'Dynasty'][v]).join(', ')}`} />
          )}
          {filters.leagueType2.length < 2 && (
            <Chip label={`${filters.leagueType2.includes(1) ? 'Best Ball' : 'Lineup'}`} />
          )}
          {filters.rosterSlots.map((s, i) => (
            <Chip key={`rs${i}`} label={`${s.position} ${s.operator} ${s.count}`} />
          ))}
          {filters.scoring.map((s, i) => (
            <Chip key={`sc${i}`} label={`${s.key.replace(/_/g, ' ')} ${s.operator} ${s.value}`} />
          ))}
          {filters.settings.map((s, i) => (
            <Chip key={`st${i}`} label={`${s.key.replace(/_/g, ' ')} ${s.operator} ${NUMERIC_SETTINGS.includes(s.key) ? s.value : s.value === 1 ? 'Yes' : 'No'}`} />
          ))}
        </View>
      )}

      <FilterModal
        visible={modalOpen}
        filters={filters}
        onSave={(f) => { setFilters(f); setModalOpen(false) }}
        onClose={() => setModalOpen(false)}
      />
    </View>
  )
}

function Chip({ label }: { label: string }) {
  return (
    <View className="rounded bg-blue-500/15 px-2 py-0.5">
      <Text className="text-[10px] text-blue-400 font-medium">{label}</Text>
    </View>
  )
}

function ToggleBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-lg px-4 py-2 ${active ? 'bg-blue-600' : 'bg-gray-800'}`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-500'}`}>{label}</Text>
    </TouchableOpacity>
  )
}

function OptionPicker({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <View className="flex-1">
      <TouchableOpacity onPress={() => setOpen(!open)} className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5">
        <Text className="text-xs text-gray-200">{value.replace(/_/g, ' ')}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView className="absolute top-8 left-0 right-0 z-50 max-h-40 rounded border border-gray-700 bg-gray-800" style={{ elevation: 10 }}>
          {options.map((opt) => (
            <TouchableOpacity key={opt} onPress={() => { onChange(opt); setOpen(false) }} className="px-2 py-1.5">
              <Text className={`text-xs ${opt === value ? 'text-blue-400' : 'text-gray-300'}`}>{opt.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function OperatorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row gap-0.5">
      {OPERATORS.map((op) => (
        <TouchableOpacity key={op} onPress={() => onChange(op)}
          className={`px-2 py-1 rounded ${value === op ? 'bg-blue-600' : 'bg-gray-800'}`}>
          <Text className={`text-xs font-medium ${value === op ? 'text-white' : 'text-gray-500'}`}>{op}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function DynamicFilterRows({
  rows,
  options,
  keyField,
  valueField,
  booleanKeys,
  onChange,
}: {
  rows: { [k: string]: unknown }[]
  options: string[]
  keyField: string
  valueField: string
  booleanKeys?: string[]
  onChange: (rows: { [k: string]: unknown }[]) => void
}) {
  const addRow = () => {
    onChange([...rows, { [keyField]: options[0], operator: '=', [valueField]: null }])
  }

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  const updateRow = (i: number, field: string, value: unknown) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  return (
    <View className="gap-2">
      {rows.map((row, i) => {
        const key = row[keyField] as string
        const isBoolean = booleanKeys?.includes(key)
        return (
          <View key={i} className="flex-row items-center gap-1.5">
            <OptionPicker
              value={key}
              options={options}
              onChange={(v) => updateRow(i, keyField, v)}
            />
            <OperatorPicker
              value={row.operator as string}
              onChange={(v) => updateRow(i, 'operator', v)}
            />
            {isBoolean ? (
              <View className="flex-row gap-0.5">
                <TouchableOpacity
                  onPress={() => updateRow(i, valueField, 1)}
                  className={`rounded px-2.5 py-1 ${row[valueField] === 1 ? 'bg-blue-600' : 'bg-gray-800'}`}>
                  <Text className={`text-xs ${row[valueField] === 1 ? 'text-white' : 'text-gray-500'}`}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateRow(i, valueField, 0)}
                  className={`rounded px-2.5 py-1 ${row[valueField] === 0 ? 'bg-blue-600' : 'bg-gray-800'}`}>
                  <Text className={`text-xs ${row[valueField] === 0 ? 'text-white' : 'text-gray-500'}`}>No</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TextInput
                keyboardType="number-pad"
                className="w-14 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 text-center"
                value={row[valueField] != null ? String(row[valueField]) : ''}
                onChangeText={(v) => updateRow(i, valueField, v === '' ? null : Number(v))}
                placeholderTextColor="#6B7280"
                placeholder="#"
              />
            )}
            <TouchableOpacity onPress={() => removeRow(i)} className="rounded bg-red-600/20 px-2 py-1">
              <Text className="text-xs text-red-400">✕</Text>
            </TouchableOpacity>
          </View>
        )
      })}
      <TouchableOpacity onPress={addRow} className="self-start rounded border border-dashed border-gray-600 px-3 py-1">
        <Text className="text-xs text-gray-500">+ Add</Text>
      </TouchableOpacity>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</Text>
      {children}
    </View>
  )
}

function FilterModal({
  visible,
  filters,
  onSave,
  onClose,
}: {
  visible: boolean
  filters: LeagueFilters
  onSave: (f: LeagueFilters) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<LeagueFilters>(filters)

  useEffect(() => setLocal(filters), [filters])

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
      leagueType1: p.leagueType1.includes(v)
        ? p.leagueType1.filter((x) => x !== v)
        : [...p.leagueType1, v],
    }))

  const toggleType2 = (v: number) =>
    setLocal((p) => ({
      ...p,
      leagueType2: p.leagueType2.includes(v)
        ? p.leagueType2.filter((x) => x !== v)
        : [...p.leagueType2, v],
    }))

  const save = () => {
    const cleaned: LeagueFilters = {
      ...local,
      rosterSlots: local.rosterSlots.filter((s) => s.count !== null),
      scoring: local.scoring.filter((s) => s.value !== null),
      settings: local.settings.filter((s) => s.value !== null),
    }
    onSave(cleaned)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-gray-900">
        <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
          <Text className="text-lg font-semibold text-gray-100">League Filters</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-400 text-[15px]">Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Section title="League Type">
            <View className="flex-row gap-2">
              {leagueType1Opts.map((opt) => (
                <ToggleBtn key={opt.value} label={opt.label} active={local.leagueType1.includes(opt.value)} onPress={() => toggleType1(opt.value)} />
              ))}
            </View>
          </Section>

          <Section title="Format">
            <View className="flex-row gap-2">
              {leagueType2Opts.map((opt) => (
                <ToggleBtn key={opt.value} label={opt.label} active={local.leagueType2.includes(opt.value)} onPress={() => toggleType2(opt.value)} />
              ))}
            </View>
          </Section>

          <Section title="Roster Slots">
            <DynamicFilterRows
              rows={local.rosterSlots}
              options={ROSTER_SLOT_OPTIONS}
              keyField="position"
              valueField="count"
              onChange={(rows) => setLocal((p) => ({ ...p, rosterSlots: rows as LeagueFilters['rosterSlots'] }))}
            />
          </Section>

          <Section title="Scoring">
            <DynamicFilterRows
              rows={local.scoring}
              options={SCORING_OPTIONS}
              keyField="key"
              valueField="value"
              onChange={(rows) => setLocal((p) => ({ ...p, scoring: rows as LeagueFilters['scoring'] }))}
            />
          </Section>

          <Section title="Settings">
            <DynamicFilterRows
              rows={local.settings}
              options={SETTINGS_OPTIONS}
              keyField="key"
              valueField="value"
              booleanKeys={SETTINGS_OPTIONS.filter((s) => !NUMERIC_SETTINGS.includes(s))}
              onChange={(rows) => setLocal((p) => ({ ...p, settings: rows as LeagueFilters['settings'] }))}
            />
          </Section>
        </ScrollView>

        <View className="flex-row justify-end gap-2 p-4 border-t border-gray-700">
          <TouchableOpacity onPress={onClose} className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2">
            <Text className="text-sm text-gray-300">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} className="rounded-lg bg-blue-600 px-4 py-2">
            <Text className="text-sm font-medium text-white">Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
