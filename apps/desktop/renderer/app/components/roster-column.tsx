import type { Allplayer, Roster } from "@sleepier/shared";
import { getPickId } from "@sleepier/shared";
import { getPickKtcName } from "../../lib/trade-utils";

const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

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
  const starters = roster.starters.filter((id) => id !== "0");
  const taxi = roster.taxi ?? [];
  const reserve = roster.reserve ?? [];
  const bench = roster.players.filter(
    (id) =>
      !starters.includes(id) && !taxi.includes(id) && !reserve.includes(id),
  );

  // Sort bench by position order, then value descending
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

  // Sort picks by season, round, order
  const sortedPicks = [...roster.draftpicks].sort((a, b) => {
    if (a.season !== b.season) return a.season.localeCompare(b.season);
    if (a.round !== b.round) return a.round - b.round;
    return (a.order ?? 99) - (b.order ?? 99);
  });

  const hlSet = new Set(highlightIds ?? []);
  const hlPickSet = new Set(highlightPickIds ?? []);
  const hlBg =
    highlightColor === "red"
      ? "bg-red-900/30 border-l-2 border-red-500"
      : "bg-green-900/30 border-l-2 border-green-500";

  const showValue = !!valueLookup;
  const fmt = formatValue ?? ((n: number) => Math.round(n).toLocaleString());
  const renderValueCell = (key: string) => {
    if (!showValue) return null;
    const v = valueLookup![key];
    return (
      <span className="ml-auto shrink-0 w-12 text-right text-[10px] font-medium text-blue-400">
        {v != null ? fmt(v) : "—"}
      </span>
    );
  };

  const renderPlayer = (id: string, slotLabel?: string) => {
    const p = allplayers[id];
    const name = p?.full_name || id;
    const pos = slotLabel ?? p?.position ?? "?";
    const team = p?.team || "";
    const isHighlighted = hlSet.has(id);
    return (
      <div
        key={id}
        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs ${isHighlighted ? hlBg : ""} ${onToggle ? "cursor-pointer hover:bg-gray-700/40" : ""}`}
        onClick={onToggle ? () => onToggle(id) : undefined}
      >
        <span className="w-6 shrink-0 text-center font-semibold text-gray-500">
          {pos}
        </span>
        <span title={name} className={`min-w-0 truncate ${isHighlighted ? "text-gray-100 font-medium" : "text-gray-300"}`}>
          {name}
        </span>
        {team && (
          <span className="shrink-0 text-gray-600 text-[10px]">{team}</span>
        )}
        {renderValueCell(id)}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </p>
      <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-1.5">
        {starters.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
              Starters
            </p>
            {starters.map((id, i) => {
              const slot = starterSlots[roster.starters.indexOf(id)];
              return renderPlayer(id, slot);
            })}
          </div>
        )}

        {sortedBench.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
              Bench
            </p>
            {sortedBench.map((id) => renderPlayer(id))}
          </div>
        )}

        {taxi.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
              Taxi
            </p>
            {taxi.map((id) => renderPlayer(id))}
          </div>
        )}

        {reserve.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
              IR
            </p>
            {reserve.map((id) => renderPlayer(id))}
          </div>
        )}

        {sortedPicks.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
              Draft Picks
            </p>
            {sortedPicks.map((pick) => {
              const pickId = getPickId(pick);
              const isPickHl = hlPickSet.has(pickId);
              const ktcName = getPickKtcName(pick.season, pick.round, pick.order);
              return (
                <div
                  key={`${pick.season}-${pick.round}-${pick.roster_id}`}
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 text-xs ${isPickHl ? hlBg : "text-gray-400"} ${onTogglePick ? "cursor-pointer hover:bg-gray-700/40" : ""}`}
                  onClick={onTogglePick ? () => onTogglePick(pickId) : undefined}
                >
                  <span className="w-6 shrink-0 text-center font-semibold text-gray-600">
                    PK
                  </span>
                  <span title={pickId} className={`min-w-0 truncate ${isPickHl ? "text-gray-100 font-medium" : ""}`}>{pickId}</span>
                  {renderValueCell(ktcName)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
