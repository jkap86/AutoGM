import { useState } from "react";
import type { LeagueDetailed } from "@autogm/shared";
import { LeaguesPanel } from "./trades/leagues-panel";
import { LeagueChatsPanel } from "./trades/league-chats-panel";
import type { TradeValueFilter } from "../../hooks/use-trade-value-filter";

type LeaguesTab = "ranks" | "chats";

export default function LeaguesView({
  leagues,
  userId,
  filter,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  userId: string;
  filter: TradeValueFilter;
}) {
  const [tab, setTab] = useState<LeaguesTab>("ranks");

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-4">
      <div className="flex gap-1 rounded-lg bg-gray-900/60 p-0.5">
        {(["ranks", "chats"] as LeaguesTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              tab === t
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "ranks" ? (
        <LeaguesPanel
          leagues={leagues}
          userId={userId}
          filter={filter}
        />
      ) : (
        <LeagueChatsPanel
          leagues={leagues}
          userId={userId}
        />
      )}
    </div>
  );
}
