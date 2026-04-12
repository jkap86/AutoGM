import type { Allplayer, Roster } from "../../../main/lib/types";
import { getPickId } from "../../lib/leagues";

export function RosterColumn({
  roster,
  allplayers,
  label,
  highlightIds,
  highlightColor,
  highlightPickIds,
  onToggle,
  onTogglePick,
}: {
  roster: Roster;
  allplayers: { [id: string]: Allplayer };
  label: string;
  highlightIds?: string[];
  highlightColor?: "red" | "green";
  highlightPickIds?: string[];
  onToggle?: (id: string) => void;
  onTogglePick?: (pickId: string) => void;
}) {
  const starters = roster.starters.filter((id) => id !== "0");
  const taxi = roster.taxi ?? [];
  const reserve = roster.reserve ?? [];
  const bench = roster.players.filter(
    (id) =>
      !starters.includes(id) && !taxi.includes(id) && !reserve.includes(id),
  );

  const hlSet = new Set(highlightIds ?? []);
  const hlPickSet = new Set(highlightPickIds ?? []);
  const hlBg =
    highlightColor === "red"
      ? "bg-red-900/30 border-l-2 border-red-500"
      : "bg-green-900/30 border-l-2 border-green-500";

  const renderPlayer = (id: string) => {
    const p = allplayers[id];
    const name = p?.full_name || id;
    const pos = p?.position || "?";
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
        <span className={`flex-1 truncate ${isHighlighted ? "text-gray-100 font-medium" : "text-gray-300"}`}>
          {name}
        </span>
        {team && (
          <span className="shrink-0 text-gray-600 text-[10px]">{team}</span>
        )}
      </div>
    );
  };

  const sections: { label: string; ids: string[] }[] = [
    { label: "Starters", ids: starters },
    { label: "Bench", ids: bench },
  ];
  if (taxi.length > 0) sections.push({ label: "Taxi", ids: taxi });
  if (reserve.length > 0) sections.push({ label: "IR", ids: reserve });

  const picks = roster.draftpicks;

  return (
    <div className="flex flex-col min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </p>
      <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-1.5">
        {sections.map(
          (section) =>
            section.ids.length > 0 && (
              <div key={section.label}>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
                  {section.label}
                </p>
                {section.ids.map(renderPlayer)}
              </div>
            ),
        )}
        {picks.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 px-1.5">
              Draft Picks
            </p>
            {picks.map((pick) => {
              const pickId = getPickId(pick);
              const isPickHl = hlPickSet.has(pickId);
              return (
                <div
                  key={`${pick.season}-${pick.round}-${pick.roster_id}`}
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 text-xs ${isPickHl ? hlBg : "text-gray-400"} ${onTogglePick ? "cursor-pointer hover:bg-gray-700/40" : ""}`}
                  onClick={onTogglePick ? () => onTogglePick(pickId) : undefined}
                >
                  <span className="w-6 shrink-0 text-center font-semibold text-gray-600">
                    PK
                  </span>
                  <span className={`truncate ${isPickHl ? "text-gray-100 font-medium" : ""}`}>{pickId}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
