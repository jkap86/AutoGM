"use client";

import { useState, useCallback } from "react";
import type { LeagueDetailed, Allplayer, CreateMessageResult } from "@sleepier/shared";
import { buildPlayerAttachment, buildUserAttachment } from "@sleepier/shared";

export function DevLeagueMessage({
  leagues,
  allplayers,
  userId,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [id: string]: Allplayer };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [leagueId, setLeagueId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [text, setText] = useState("");
  const [playerIdsGive, setPlayerIdsGive] = useState("");
  const [playerIdsReceive, setPlayerIdsReceive] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const league = leagueId ? leagues[leagueId] : null;
  const partners = league
    ? league.rosters.filter((r) => r.user_id !== userId)
    : [];

  const send = useCallback(async () => {
    if (!league || !text.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const hasTradeData = partnerId && (playerIdsGive.trim() || playerIdsReceive.trim());

      if (hasTradeData) {
        const userRoster = league.user_roster;
        const partnerRoster = league.rosters.find((r) => r.user_id === partnerId);
        if (!partnerRoster) throw new Error("Partner not found");

        const giveIds = playerIdsGive.split(",").map((s) => s.trim()).filter(Boolean);
        const receiveIds = playerIdsReceive.split(",").map((s) => s.trim()).filter(Boolean);

        const anonUser = (roster: typeof userRoster) => {
          const att = buildUserAttachment(roster, leagueId);
          return { ...att, user_id: null };
        };

        const transactionsByRoster: Record<string, unknown> = {
          [userRoster.roster_id]: {
            adds: receiveIds.map((pid) => buildPlayerAttachment(allplayers[pid])),
            drops: [],
            added_picks: [],
            dropped_picks: [],
            added_budget: [],
            dropped_budget: [],
            status: "proposed",
            user: anonUser(userRoster),
          },
          [partnerRoster.roster_id]: {
            adds: giveIds.map((pid) => buildPlayerAttachment(allplayers[pid])),
            drops: [],
            added_picks: [],
            dropped_picks: [],
            added_budget: [],
            dropped_budget: [],
            status: "proposed",
            user: anonUser(partnerRoster),
          },
        };

        const usersMap: Record<string, unknown> = {};
        league.rosters.forEach((r) => {
          usersMap[r.user_id] = { ...buildUserAttachment(r, leagueId), user_id: null };
        });

        await window.ipc.invoke<CreateMessageResult>("graphql", {
          name: "createLeagueMessage",
          vars: {
            parent_id: leagueId,
            text: text.trim(),
            attachment_type: "trade",
            k_attachment_data: [
              "status",
              "transactions_by_roster",
              "league_id",
              "users_in_league_map",
            ],
            v_attachment_data: [
              "proposed",
              JSON.stringify(transactionsByRoster),
              leagueId,
              JSON.stringify(usersMap),
            ],
          },
        });
      } else {
        await window.ipc.invoke<CreateMessageResult>("graphql", {
          name: "createLeagueMessage",
          vars: { parent_id: leagueId, text: text.trim(), attachment_type: "trade" },
        });
      }

      setResult("Sent!");
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [league, partnerId, text, playerIdsGive, playerIdsReceive, allplayers, userId, leagueId]);

  if (process.env.NODE_ENV === "production") return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-yellow-600 w-10 h-10 flex items-center justify-center text-white text-sm font-bold shadow-lg hover:bg-yellow-500 transition"
        title="Dev: Send trade message to league"
      >
        DV
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg bg-gray-900 border border-yellow-600/50 shadow-2xl flex flex-col text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/40">
        <span className="text-yellow-400 font-semibold text-[11px]">DEV: Trade Message</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">X</button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <select
          value={leagueId}
          onChange={(e) => { setLeagueId(e.target.value); setPartnerId(""); }}
          className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
        >
          <option value="">Select league...</option>
          {Object.values(leagues).map((l) => (
            <option key={l.league_id} value={l.league_id}>{l.name}</option>
          ))}
        </select>

        {league && (
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
          >
            <option value="">Select partner...</option>
            {partners.filter((r) => r.user_id).map((r) => (
              <option key={r.roster_id} value={r.user_id}>{r.username}</option>
            ))}
          </select>
        )}

        <input
          value={playerIdsGive}
          onChange={(e) => setPlayerIdsGive(e.target.value)}
          placeholder="Player IDs giving (comma sep)"
          className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
        />
        <input
          value={playerIdsReceive}
          onChange={(e) => setPlayerIdsReceive(e.target.value)}
          placeholder="Player IDs receiving (comma sep)"
          className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message text..."
          className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
        />

        <button
          onClick={send}
          disabled={!leagueId || !text.trim() || sending}
          className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-yellow-500 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Trade Message"}
        </button>

        {result && (
          <span className={`text-[10px] ${result === "Sent!" ? "text-green-400" : "text-red-400"}`}>
            {result}
          </span>
        )}
      </div>
    </div>
  );
}
