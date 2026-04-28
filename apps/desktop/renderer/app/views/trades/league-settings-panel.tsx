import type { LeagueDetailed } from "@autogm/shared";

// ── Scoring: grouped by category, ordered logically ─────────────────

const SCORING_ORDER: { label: string; keys: string[] }[] = [
  { label: "Passing", keys: ["pass_yd", "pass_td", "pass_int", "pass_2pt", "pass_att", "pass_cmp", "pass_cmp_40p", "pass_td_40p", "pass_fd"] },
  { label: "Rushing", keys: ["rush_yd", "rush_td", "rush_att", "rush_2pt", "rush_fd", "rush_td_40p"] },
  { label: "Receiving", keys: ["rec", "rec_yd", "rec_td", "rec_2pt", "rec_fd", "rec_td_40p", "bonus_rec_te", "bonus_rec_rb", "bonus_rec_wr"] },
  { label: "Bonuses", keys: ["bonus_pass_yd_300", "bonus_pass_yd_400", "bonus_rush_yd_100", "bonus_rush_yd_200", "bonus_rec_yd_100", "bonus_rec_yd_200"] },
  { label: "Turnovers", keys: ["fum", "fum_lost", "fum_rec", "fum_rec_td"] },
  { label: "Special Teams", keys: ["st_td", "st_ff", "st_fum_rec", "kr_yd", "pr_yd"] },
  { label: "Kicking", keys: ["fgm", "fgmiss", "xpm", "xpmiss", "fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50p"] },
  { label: "Defense", keys: ["def_td", "def_st_td", "def_st_ff", "def_st_fum_rec", "sack", "int", "ff", "blk_kick", "safe", "pts_allow_0", "pts_allow_1_6", "pts_allow_7_13", "pts_allow_14_20", "pts_allow_21_27", "pts_allow_28_34", "pts_allow_35p"] },
  { label: "IDP", keys: ["idp_tkl", "idp_tkl_ast", "idp_tkl_solo", "idp_tkl_loss", "idp_sack", "idp_qb_hit", "idp_int", "idp_ff", "idp_fum_rec", "idp_def_td", "idp_pass_def", "idp_blk_kick", "idp_safe"] },
];

const SCORING_LABELS: Record<string, string> = {
  pass_yd: "Pass Yds", pass_td: "Pass TD", pass_int: "Interception", pass_2pt: "Pass 2pt",
  pass_att: "Pass Att", pass_cmp: "Completion", pass_cmp_40p: "40+ Yd Cmp", pass_td_40p: "40+ Yd Pass TD", pass_fd: "Pass 1st Down",
  rush_yd: "Rush Yds", rush_td: "Rush TD", rush_att: "Rush Att", rush_2pt: "Rush 2pt",
  rush_fd: "Rush 1st Down", rush_td_40p: "40+ Yd Rush TD",
  rec: "Reception", rec_yd: "Rec Yds", rec_td: "Rec TD", rec_2pt: "Rec 2pt",
  rec_fd: "Rec 1st Down", rec_td_40p: "40+ Yd Rec TD",
  bonus_rec_te: "TE Premium", bonus_rec_rb: "RB Rec Bonus", bonus_rec_wr: "WR Rec Bonus",
  bonus_pass_yd_300: "300+ Pass Yds", bonus_pass_yd_400: "400+ Pass Yds",
  bonus_rush_yd_100: "100+ Rush Yds", bonus_rush_yd_200: "200+ Rush Yds",
  bonus_rec_yd_100: "100+ Rec Yds", bonus_rec_yd_200: "200+ Rec Yds",
  fum: "Fumble", fum_lost: "Fumble Lost", fum_rec: "Fumble Rec", fum_rec_td: "Fumble Rec TD",
  st_td: "ST TD", st_ff: "ST Forced Fum", st_fum_rec: "ST Fum Rec", kr_yd: "Kick Ret Yds", pr_yd: "Punt Ret Yds",
  fgm: "FG Made", fgmiss: "FG Missed", xpm: "XP Made", xpmiss: "XP Missed",
  fgm_0_19: "FG 0-19", fgm_20_29: "FG 20-29", fgm_30_39: "FG 30-39", fgm_40_49: "FG 40-49", fgm_50p: "FG 50+",
  sack: "Sack", int: "INT", ff: "Forced Fum", blk_kick: "Blocked Kick", safe: "Safety",
  def_td: "Def TD", def_st_td: "Def/ST TD", def_st_ff: "Def/ST FF", def_st_fum_rec: "Def/ST Fum Rec",
  idp_tkl: "Tackle", idp_tkl_ast: "Tackle Ast", idp_tkl_solo: "Solo Tackle", idp_tkl_loss: "TFL",
  idp_sack: "IDP Sack", idp_qb_hit: "QB Hit", idp_int: "IDP INT", idp_ff: "IDP FF",
  idp_fum_rec: "IDP Fum Rec", idp_def_td: "IDP Def TD", idp_pass_def: "Pass Defended", idp_blk_kick: "IDP Blk Kick", idp_safe: "IDP Safety",
};

// ── Settings ────────────────────────────────────────────────────────

const SETTINGS_ORDER: { key: string; label: string }[] = [
  { key: "type", label: "League Type" },
  { key: "best_ball", label: "Best Ball" },
  { key: "draft_rounds", label: "Draft Rounds" },
  { key: "taxi_slots", label: "Taxi Slots" },
  { key: "reserve_slots", label: "IR Slots" },
  { key: "playoff_week_start", label: "Playoffs Start" },
  { key: "trade_deadline", label: "Trade Deadline" },
  { key: "disable_trades", label: "Trades Disabled" },
  { key: "daily_waivers", label: "Daily Waivers" },
  { key: "league_average_match", label: "League Avg Match" },
  { key: "reserve_allow_na", label: "IR: N/A" },
  { key: "reserve_allow_doubtful", label: "IR: Doubtful" },
];

const TYPE_LABELS: Record<number, string> = { 0: "Redraft", 1: "Keeper", 2: "Dynasty" };
const BOOLEAN_KEYS = new Set(["best_ball", "disable_trades", "daily_waivers", "league_average_match", "reserve_allow_na", "reserve_allow_doubtful"]);

function formatSettingValue(key: string, value: number): string {
  if (key === "type") return TYPE_LABELS[value] ?? String(value);
  if (BOOLEAN_KEYS.has(key)) return value ? "Yes" : "No";
  if (key === "trade_deadline" || key === "playoff_week_start") return value === 0 ? "None" : `Week ${value}`;
  return String(value);
}

// ── Roster slot display order ───────────────────────────────────────

const SLOT_ORDER = [
  "QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "REC_FLEX", "WRRB_FLEX",
  "K", "DEF", "DL", "LB", "DB", "IDP_FLEX", "BN", "TAXI", "IR",
];

const SLOT_COLORS: Record<string, string> = {
  QB: "text-red-400 bg-red-500/10 border-red-500/20",
  RB: "text-green-400 bg-green-500/10 border-green-500/20",
  WR: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  TE: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  FLEX: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  SUPER_FLEX: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  REC_FLEX: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  WRRB_FLEX: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  K: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  DEF: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  BN: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const SLOT_LABELS: Record<string, string> = {
  SUPER_FLEX: "SF",
  REC_FLEX: "Rec Flex",
  WRRB_FLEX: "W/R",
  IDP_FLEX: "IDP",
};

export function LeagueSettingsPanel({ league }: { league: LeagueDetailed }) {
  const settings = league.settings;
  const scoring = league.scoring_settings ?? {};
  const positions = league.roster_positions ?? [];

  // Count roster slots in display order
  const slotCounts: Record<string, number> = {};
  for (const pos of positions) {
    slotCounts[pos] = (slotCounts[pos] ?? 0) + 1;
  }
  const orderedSlots = [
    ...SLOT_ORDER.filter((p) => slotCounts[p]),
    ...Object.keys(slotCounts).filter((p) => !SLOT_ORDER.includes(p)),
  ];

  // Build scored groups (only categories that have non-zero values)
  const scoringGroups = SCORING_ORDER
    .map((group) => ({
      label: group.label,
      entries: group.keys.filter((k) => scoring[k] != null && scoring[k] !== 0).map((k) => [k, scoring[k]] as const),
    }))
    .filter((g) => g.entries.length > 0);

  const knownKeys = new Set(SCORING_ORDER.flatMap((g) => g.keys));
  const extraScoring = Object.entries(scoring).filter(([k, v]) => !knownKeys.has(k) && v !== 0);
  if (extraScoring.length > 0) {
    scoringGroups.push({ label: "Other", entries: extraScoring.map(([k, v]) => [k, v] as const) });
  }

  // Build settings in order
  const knownSettingKeys = new Set(SETTINGS_ORDER.map((s) => s.key));
  const orderedSettings = [
    ...SETTINGS_ORDER.filter((s) => (settings as Record<string, unknown>)[s.key] != null),
    ...Object.keys(settings)
      .filter((k) => !knownSettingKeys.has(k))
      .map((k) => ({ key: k, label: k.replace(/_/g, " ") })),
  ];

  return (
    <div className="px-4 py-4 flex flex-col gap-5 max-h-96 overflow-y-auto">
      {/* Roster Slots */}
      <Section title="Roster Slots">
        <div className="flex flex-wrap gap-2">
          {orderedSlots.map((pos) => {
            const colors = SLOT_COLORS[pos] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20";
            return (
              <div
                key={pos}
                className={`flex flex-col items-center rounded-lg border px-3 py-1.5 min-w-[48px] ${colors}`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                  {SLOT_LABELS[pos] ?? pos}
                </span>
                <span className="text-lg font-bold font-[family-name:var(--font-heading)] leading-tight">
                  {slotCounts[pos]}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Scoring Settings — grouped */}
      <Section title="Scoring">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {scoringGroups.map((group) => (
            <div key={group.label} className="rounded-lg bg-gray-900/40 border border-gray-700/30 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{group.label}</span>
              <div className="flex flex-col gap-0.5 mt-1.5">
                {group.entries.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400">{SCORING_LABELS[key] ?? key.replace(/_/g, " ")}</span>
                    <span className={`text-xs font-bold tabular-nums ${
                      value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-gray-300"
                    }`}>
                      {value > 0 ? "+" : ""}{Math.round(value * 100) / 100}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* League Settings */}
      <Section title="League Settings">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {orderedSettings.map(({ key, label }) => {
            const raw = (settings as Record<string, unknown>)[key] as number;
            const display = formatSettingValue(key, raw);
            const isHighlight = key === "type" || key === "best_ball";
            const isBool = BOOLEAN_KEYS.has(key);
            return (
              <div key={key} className="flex items-center justify-between gap-2 py-0.5">
                <span className={`text-xs ${isHighlight ? "text-gray-300 font-medium" : "text-gray-500"}`}>{label}</span>
                {isBool ? (
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${
                    raw ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-500"
                  }`}>
                    {display}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${isHighlight ? "text-blue-400" : "text-gray-200"}`}>
                    {display}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 pb-1 border-b border-gray-700/40">
        {title}
      </h4>
      {children}
    </div>
  );
}
