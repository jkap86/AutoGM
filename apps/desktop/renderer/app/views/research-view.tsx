"use client";

import { useState } from "react";
import type { Allplayer, LeagueDetailed } from "@autogm/shared";
import PollsView from "./polls-view";
import AdpView from "./adp-view";
import KtcView from "./ktc-view";

type ResearchTab = "polls" | "adp" | "ktc";

export default function ResearchView({
  leagues,
  allplayers,
  ktc,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [player_id: string]: Allplayer };
  ktc: Record<string, number>;
}) {
  const [tab, setTab] = useState<ResearchTab>("polls");

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900/60 p-0.5">
        {([
          { key: "polls" as ResearchTab, label: "Polls" },
          { key: "adp" as ResearchTab, label: "ADP" },
          { key: "ktc" as ResearchTab, label: "KTC" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              tab === key
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "polls" ? (
        <PollsView leagues={leagues} />
      ) : tab === "adp" ? (
        <AdpView allplayers={allplayers} />
      ) : (
        <KtcView allplayers={allplayers} ktc={ktc} />
      )}
    </div>
  );
}
