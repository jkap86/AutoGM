"use client";

import { useMemo, useState } from "react";
import type { Allplayer } from "@autogm/shared";

const POSITION_OPTIONS = ["ALL", "QB", "RB", "WR", "TE"] as const;
type PositionFilter = (typeof POSITION_OPTIONS)[number];

type KtcRow = {
  id: string;
  name: string;
  position: string;
  team: string;
  age: string;
  value: number;
};

export default function KtcView({
  allplayers,
  ktc,
}: {
  allplayers: { [id: string]: Allplayer };
  ktc: Record<string, number>;
}) {
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const result: KtcRow[] = [];
    for (const [id, value] of Object.entries(ktc)) {
      const player = allplayers[id];
      if (!player) continue;
      const pos = player.position ?? "";
      if (!["QB", "RB", "WR", "TE"].includes(pos)) continue;
      result.push({
        id,
        name: `${player.first_name} ${player.last_name}`,
        position: pos,
        team: player.team || "FA",
        age: player.age != null ? String(player.age) : "—",
        value,
      });
    }
    result.sort((a, b) => b.value - a.value);
    return result;
  }, [ktc, allplayers]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (positionFilter !== "ALL" && row.position !== positionFilter) return false;
      if (search) {
        if (!row.name.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, positionFilter, search]);

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {POSITION_OPTIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              positionFilter === pos
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {pos}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-800/80 text-gray-400">
            <tr>
              <th className="text-right px-3 py-2 font-semibold w-12">#</th>
              <th className="text-left px-3 py-2 font-semibold">Player</th>
              <th className="text-left px-3 py-2 font-semibold">Pos</th>
              <th className="text-left px-3 py-2 font-semibold">Team</th>
              <th className="text-right px-3 py-2 font-semibold">Age</th>
              <th className="text-right px-3 py-2 font-semibold">KTC Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map((row, i) => (
              <tr
                key={row.id}
                className="border-t border-gray-700/40 hover:bg-gray-800/40"
              >
                <td className="px-3 py-1.5 text-right text-gray-500">{i + 1}</td>
                <td className="px-3 py-1.5 text-gray-100">{row.name}</td>
                <td className="px-3 py-1.5 text-gray-400">{row.position}</td>
                <td className="px-3 py-1.5 text-gray-400">{row.team}</td>
                <td className="px-3 py-1.5 text-right text-gray-400">{row.age}</td>
                <td className="px-3 py-1.5 text-right text-blue-400 font-semibold">
                  {row.value.toLocaleString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No players found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <div className="px-3 py-2 text-center text-xs text-gray-500 bg-gray-800/40">
            Showing first 500 of {filtered.length} players
          </div>
        )}
      </div>
    </div>
  );
}
