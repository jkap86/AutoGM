import { useCallback, useEffect, useState } from "react";
import type { LeagueDetailed, Message, GetDmByMembersResult, MessagesResult } from "@sleepier/shared";
import { formatTime } from "../../../lib/trade-utils";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function deepParseJson(val: unknown): unknown {
  if (typeof val === "string") {
    try {
      return deepParseJson(JSON.parse(val));
    } catch {
      return val;
    }
  }
  if (Array.isArray(val)) return val.map(deepParseJson);
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = deepParseJson(v);
    }
    return out;
  }
  return val;
}

function parseAttachment(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  const parsed = deepParseJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

export function DmPanel({ userId, partnerId, partnerName, leagues }: { userId: string; partnerId: string; partnerName: string; leagues: { [league_id: string]: LeagueDetailed } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmId, setDmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dmResult = await window.ipc.invoke<GetDmByMembersResult>("graphql", {
        name: "getDmByMembers",
        vars: { members: [userId, partnerId] },
      });
      const id = dmResult.get_dm_by_members?.dm_id;
      setDmId(id ?? null);
      if (!id) {
        setMessages([]);
        setLoading(false);
        return;
      }
      const msgResult = await window.ipc.invoke<MessagesResult>("graphql", {
        name: "messages",
        vars: { parent_id: id },
      });
      setMessages(msgResult.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, partnerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !dmId || sending) return;
    setSending(true);
    setError(null);
    try {
      await window.ipc.invoke("graphql", {
        name: "createMessage",
        vars: {
          parent_id: dmId,
          text,
          k_attachment_data: [],
          v_attachment_data: [],
        },
      });
      setDraft("");
      await fetchMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [draft, dmId, sending, fetchMessages]);

  const sorted = [...messages].sort((a, b) => a.created - b.created);

  return (
    <div className="flex flex-col">
      {/* Messages area */}
      <div className="flex flex-col gap-1 px-4 py-3 max-h-72 overflow-y-auto flex-col-reverse">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <span className="text-xs text-gray-500">Loading DMs...</span>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={fetchMessages} className="text-xs text-gray-400 hover:text-gray-200 underline">Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <span className="text-xs text-gray-500">No DMs with {partnerName}</span>
          </div>
        ) : (
        <div className="flex flex-col gap-1">
        {sorted.map((msg) => {
          const isUser = msg.author_id === userId;
          const att = parseAttachment(msg.attachment);
          return (
            <div key={msg.message_id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-1.5 ${isUser ? "bg-blue-600/20" : "bg-gray-700/60"}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-xs font-semibold ${isUser ? "text-blue-400" : "text-gray-300"}`}>
                    {msg.author_display_name}
                  </span>
                  <span className="text-xs text-gray-600">{formatTime(msg.created)}</span>
                </div>
                {msg.text && <p className="text-xs text-gray-200 whitespace-pre-wrap">{decodeHtmlEntities(msg.text)}</p>}
                {att && <AttachmentView attachment={att} leagues={leagues} />}
              </div>
            </div>
          );
        })}
        </div>
        )}
      </div>

      {/* Message input */}
      <div className="flex items-center gap-2 border-t border-gray-700/40 px-4 py-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={dmId ? `Message ${partnerName}...` : "Loading..."}
          disabled={!dmId || sending}
          className="flex-1 rounded bg-gray-900 border border-gray-700 px-2.5 py-1.5 text-xs text-gray-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || !dmId || sending}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      {error && messages.length > 0 && (
        <div className="px-4 pb-2">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}

// ---- Attachment rendering ----

type PlayerAtt = { first_name?: string; last_name?: string; position?: string; team?: string; player_id?: string };
type PickAtt = { roster_id?: string; season?: string; round?: string; order?: number | string | null; owner_id?: string; previous_owner_id?: string; original_owner_id?: string };
type UserAtt = { display_name?: string; avatar?: string; user_id?: string };
type RosterTransaction = {
  adds?: PlayerAtt[];
  drops?: PlayerAtt[];
  added_picks?: PickAtt[];
  dropped_picks?: PickAtt[];
  user?: UserAtt;
};

function formatPickLabel(
  pk: PickAtt,
  ownerRid: string,
  usersMap: Record<string, UserAtt> | undefined,
  leagues: { [league_id: string]: LeagueDetailed } | undefined,
  leagueId: string | undefined,
) {
  let order: number | null = null;
  if (leagues && leagueId && pk.roster_id && pk.season && pk.round) {
    const league = leagues[leagueId];
    const rid = Number(pk.roster_id);
    const season = String(pk.season);
    const round = Number(pk.round);
    if (league) {
      for (const roster of league.rosters) {
        const match = roster.draftpicks.find(
          (dp) =>
            dp.roster_id === rid &&
            String(dp.season) === season &&
            dp.round === round,
        );
        if (match?.order != null) {
          order = match.order;
          break;
        }
      }
    }
  }

  if (order) {
    return `${pk.season} ${pk.round}.${String(order).padStart(2, "0")}`;
  }
  const originalOwnerId = pk.original_owner_id;
  if (originalOwnerId && originalOwnerId !== ownerRid && usersMap) {
    const origUser = Object.values(usersMap).find((u) => u.user_id === originalOwnerId);
    if (origUser?.display_name) {
      return `${pk.season} Round ${pk.round} (${origUser.display_name})`;
    }
  }
  return `${pk.season} Round ${pk.round}`;
}

function AttachmentView({ attachment, leagues }: { attachment: Record<string, unknown>; leagues?: { [league_id: string]: LeagueDetailed } }) {
  const txByRoster = attachment.transactions_by_roster as Record<string, RosterTransaction> | undefined;
  const usersMap = attachment.users_in_league_map as Record<string, UserAtt> | undefined;
  const leagueId = attachment.league_id as string | undefined;
  if (txByRoster) {
    return (
      <div className="mt-1 rounded bg-gray-800 px-2 py-1.5">
        <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Trade Proposal</span>
        <div className="flex flex-col gap-2 mt-1">
          {Object.entries(txByRoster).map(([rid, side]) => {
            const name = side.user?.display_name ?? `Roster ${rid}`;
            const adds = side.adds ?? [];
            const drops = side.drops ?? [];
            const addedPicks = side.added_picks ?? [];
            const droppedPicks = side.dropped_picks ?? [];
            return (
              <div key={rid}>
                <span className="text-xs font-semibold text-gray-300">{name}</span>
                {adds.map((p, i) => (
                  <div key={`a${i}`} className="text-xs text-green-400 ml-2">
                    + {p.first_name} {p.last_name} <span className="text-green-600 text-xs">{p.position} - {p.team}</span>
                  </div>
                ))}
                {drops.map((p, i) => (
                  <div key={`d${i}`} className="text-xs text-red-400 ml-2">
                    − {p.first_name} {p.last_name} <span className="text-red-600 text-xs">{p.position} - {p.team}</span>
                  </div>
                ))}
                {addedPicks.map((pk, i) => (
                  <div key={`ap${i}`} className="text-xs text-blue-400 ml-2">
                    + {formatPickLabel(pk, rid, usersMap, leagues, leagueId)}
                  </div>
                ))}
                {droppedPicks.map((pk, i) => (
                  <div key={`dp${i}`} className="text-xs text-orange-400 ml-2">
                    − {formatPickLabel(pk, rid, usersMap, leagues, leagueId)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const prompt = attachment.prompt as string | undefined;
  if (prompt || attachment.poll_id) {
    const choices = attachment.choices as string[] | undefined;
    return (
      <div className="mt-1 rounded bg-gray-800 px-2 py-1.5">
        <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Poll</span>
        {prompt && <p className="text-xs text-gray-200 mt-0.5">{prompt}</p>}
        {choices && (
          <div className="flex flex-col gap-0.5 mt-1">
            {choices.map((c, i) => (
              <span key={i} className="text-xs text-gray-400">• {c}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const gifUrl = (attachment.fixed_height_mp4 ?? attachment.fixed_height_small_mp4 ?? attachment.original_mp4) as string | undefined;
  const gifStill = (attachment.fixed_height_still ?? attachment.original_still) as string | undefined;
  if (gifUrl) {
    return (
      <div className="mt-1">
        <video
          src={gifUrl}
          autoPlay
          loop
          muted
          playsInline
          className="max-w-full max-h-40 rounded"
          poster={gifStill}
        />
      </div>
    );
  }

  const url = (attachment.url ?? attachment.image_url ?? attachment.original_still) as string | undefined;
  if (url) {
    return (
      <div className="mt-1">
        <img src={url} alt="attachment" className="max-w-full max-h-40 rounded" />
      </div>
    );
  }

  const type = attachment.type as string | undefined;
  return (
    <div className="mt-1 rounded bg-gray-800 px-2 py-1.5">
      <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
        {type ?? "Attachment"}
      </span>
      <p className="text-xs text-gray-500 mt-0.5 break-all">
        {JSON.stringify(attachment, null, 0).slice(0, 200)}
      </p>
    </div>
  );
}
