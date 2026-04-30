import type { Allplayer, Roster } from "@autogm/shared";
import { getPickId } from "@autogm/shared";
import { getPickKtcName } from "../../lib/trade-utils";

const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

const SLOT_ABBREV: Record<string, string> = {
  SUPER_FLEX: "FLEX",
  REC_FLEX: "RFLEX",
  WRRB_FLEX: "W/R",
  IDP_FLEX: "IDP",
};

const POS_COLOR: Record<string, string> = {
  QB: "text-red-400",
  RB: "text-blue-400",
  WR: "text-green-400",
  TE: "text-yellow-400",
  K: "text-purple-400",
  DEF: "text-orange-400",
};

export function RosterColumn({
  roster,
  allplayers,
  label,
  highlightIds,
  highlightColor,
  highlightPickIds,
  onToggle,
  onTogglePick,
  valueLookup,
  formatValue,
  rosterPositions,
}: {
  roster: Roster;
  allplayers: { [id: string]: Allplayer };
  label: string;
  highlightIds?: string[];
  highlightColor?: "red" | "green";
  highlightPickIds?: string[];
  onToggle?: (id: string) => void;
  onTogglePick?: (pickId: string) => void;
  valueLookup?: Record<string, number>;
  formatValue?: (n: number) => string;
  rosterPositions?: string[];
}) {
  const starterSlots = (rosterPositions ?? []).filter(
    (s) => s !== "BN" && s !== "IR" && s !== "TAXI",
  );
  const starters = roster.starters;
  const taxi = roster.taxi ?? [];
  const reserve = roster.reserve ?? [];
  const bench = roster.players.filter(
    (id) =>
      !starters.includes(id) && !taxi.includes(id) && !reserve.includes(id),
  );

  const sortedBench = [...bench].sort((a, b) => {
    const pa = allplayers[a]?.position ?? "?";
    const pb = allplayers[b]?.position ?? "?";
    const posA = POS_ORDER[pa] ?? 99;
    const posB = POS_ORDER[pb] ?? 99;
    if (posA !== posB) return posA - posB;
    const va = valueLookup?.[a] ?? 0;
    const vb = valueLookup?.[b] ?? 0;
    return vb - va;
  });

  const sortedPicks = [...roster.draftpicks].sort((a, b) => {
    if (a.season !== b.season) return a.season.localeCompare(b.season);
    if (a.round !== b.round) return a.round - b.round;
    return (a.order ?? 99) - (b.order ?? 99);
  });

  const hlSet = new Set(highlightIds ?? []);
  const hlPickSet = new Set(highlightPickIds ?? []);

  const hlBorder =
    highlightColor === "red" ? "border-l-red-500" : "border-l-green-500";
  const hlBg =
    highlightColor === "red" ? "bg-red-500/8" : "bg-green-500/8";

  const showValue = !!valueLookup;
  const fmt = formatValue ?? ((n: number) => Math.round(n).toLocaleString());

  const renderPlayer = (id: string, slotLabel?: string, index?: number) => {
    const isEmpty = id === "0";
    const p = isEmpty ? undefined : allplayers[id];
    const name = isEmpty ? "Empty" : (p?.full_name || id);
    const rawPos = slotLabel ?? p?.position ?? "?";
    const pos = SLOT_ABBREV[rawPos] ?? rawPos;
    const team = isEmpty ? "" : (p?.team || "");
    const isHighlighted = !isEmpty && hlSet.has(id);
    const posColor = POS_COLOR[p?.position ?? ""] ?? "text-gray-500";

    return (
      <div
        key={index != null ? `${index}-${id}` : id}
        className={`group flex items-center gap-2 px-2 py-[5px] rounded-md border-l-2 transition-colors ${
          isHighlighted
            ? `${hlBg} ${hlBorder}`
            : "border-l-transparent hover:bg-gray-700/30"
        } ${!isEmpty && onToggle ? "cursor-pointer" : ""}`}
        onClick={!isEmpty && onToggle ? () => onToggle(id) : undefined}
      >
        <span className={`w-7 shrink-0 text-center text-[10px] font-bold uppercase ${
          isHighlighted ? (highlightColor === "red" ? "text-red-400" : "text-green-400") : posColor
        }`}>
          {pos}
        </span>
        <span
          title={isEmpty ? undefined : name}
          className={`min-w-0 truncate text-[13px] leading-tight ${
            isEmpty
              ? "text-gray-600 italic"
              : isHighlighted ? "text-gray-100 font-medium" : "text-gray-300"
          }`}
        >
          {name}
        </span>
        {team && (
          <span className="shrink-0 text-[10px] text-gray-600 font-medium">{team}</span>
        )}
        {!isEmpty && showValue && (() => {
          const v = valueLookup![id];
          return (
            <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-gray-500">
              {v != null ? fmt(v) : ""}
            </span>
          );
        })()}
      </div>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 px-2 pt-2 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{children}</span>
      <div className="flex-1 h-px bg-gray-700/50" />
    </div>
  );

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
          {label}
        </span>
        <span className="text-[10px] text-gray-600 font-medium">
          {roster.players.length} players
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-700/50 bg-gray-900/30">
        {starters.length > 0 && (
          <div>
            <SectionLabel>Starters</SectionLabel>
            <div className="flex flex-col gap-px px-1 pb-1">
              {starters.map((id, i) => {
                const slot = starterSlots[i];
                return renderPlayer(id, slot, i);
              })}
            </div>
          </div>
        )}

        {sortedBench.length > 0 && (
          <div>
            <SectionLabel>Bench</SectionLabel>
            <div className="flex flex-col gap-px px-1 pb-1">
              {sortedBench.map((id) => renderPlayer(id))}
            </div>
          </div>
        )}

        {taxi.length > 0 && (
          <div>
            <SectionLabel>Taxi</SectionLabel>
            <div className="flex flex-col gap-px px-1 pb-1">
              {taxi.map((id) => renderPlayer(id))}
            </div>
          </div>
        )}

        {reserve.length > 0 && (
          <div>
            <SectionLabel>IR</SectionLabel>
            <div className="flex flex-col gap-px px-1 pb-1">
              {reserve.map((id) => renderPlayer(id))}
            </div>
          </div>
        )}

        {sortedPicks.length > 0 && (
          <div>
            <SectionLabel>Draft Picks</SectionLabel>
            <div className="flex flex-col gap-px px-1 pb-1">
              {sortedPicks.map((pick) => {
                const pickId = getPickId(pick);
                const isPickHl = hlPickSet.has(pickId);
                const specificKey = pick.order && pick.order > 0
                  ? `${pick.season} ${pick.round}.${String(pick.order).padStart(2, '0')}`
                  : null;
                const ktcName = getPickKtcName(pick.season, pick.round, pick.order);
                const pickValueKey = (specificKey && valueLookup && valueLookup[specificKey] != null) ? specificKey : ktcName;

                return (
                  <div
                    key={`${pick.season}-${pick.round}-${pick.roster_id}`}
                    className={`group flex items-center gap-2 px-2 py-[5px] rounded-md border-l-2 transition-colors ${
                      isPickHl
                        ? `${hlBg} ${hlBorder}`
                        : "border-l-transparent hover:bg-gray-700/30"
                    } ${onTogglePick ? "cursor-pointer" : ""}`}
                    onClick={onTogglePick ? () => onTogglePick(pickId) : undefined}
                  >
                    <span className={`w-7 shrink-0 text-center text-[10px] font-bold uppercase ${
                      isPickHl ? (highlightColor === "red" ? "text-red-400" : "text-green-400") : "text-amber-500/70"
                    }`}>
                      PK
                    </span>
                    <span
                      title={pickId}
                      className={`min-w-0 truncate text-[13px] leading-tight ${
                        isPickHl ? "text-gray-100 font-medium" : "text-gray-400"
                      }`}
                    >
                      {pickId}
                    </span>
                    {showValue && (() => {
                      const v = valueLookup![pickValueKey];
                      return (
                        <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-gray-500">
                          {v != null ? fmt(v) : ""}
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
