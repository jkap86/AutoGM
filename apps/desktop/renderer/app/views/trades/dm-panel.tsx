import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeagueDetailed, Message, GetDmByMembersResult, MessagesResult, MessageCreatedPayload } from "@autogm/shared";
import { SleeperTopics, messageFromSocket } from "@autogm/shared";
import { useGatewayTopic } from "../../../contexts/socket-context";
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

export function cleanText(text: string): string {
  return decodeHtmlEntities(text).replace(/<@([^>]+)>/g, "@$1");
}

export function parseAttachment(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  const parsed = deepParseJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

export const DmPanel = memo(function DmPanel({ userId, partnerId, partnerName, leagues, onNewMessage }: { userId: string; partnerId: string; partnerName: string; leagues: { [league_id: string]: LeagueDetailed }; onNewMessage?: (text: string, time: number, author: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmId, setDmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let id: string | undefined;
      try {
        const dmResult = await window.ipc.invoke<GetDmByMembersResult>("graphql", {
          name: "getDmByMembers",
          vars: { members: [userId, partnerId] },
        });
        id = dmResult.get_dm_by_members?.dm_id;
      } catch {
        // DM doesn't exist yet or pending invite — check inbound requests
        try {
          const result = await window.ipc.invoke<{ inbound_requests: Array<{ requester_id: string; type_id: string }> }>("graphql", {
            name: "inboundRequests",
            vars: { request_type: "dm_single" },
          });
          const match = result.inbound_requests?.find((r) => r.requester_id === partnerId);
          if (match) {
            // Accept the pending DM invite
            try {
              await window.ipc.invoke("graphql", {
                name: "acceptRequest",
                vars: { request_type: "dm_single", requester_id: partnerId, type_id: match.type_id },
              });
            } catch {
              // may already be accepted
            }
            id = match.type_id;
          }
        } catch {
          // fallback failed
        }
      }
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
      const msgs = msgResult.messages ?? [];
      setMessages(msgs);
      // Update preview with the latest message
      if (msgs.length > 0) {
        const latest = msgs.reduce((a, b) => (a.created > b.created ? a : b));
        onNewMessageRef.current?.(latest.text || "Attachment", latest.created, latest.author_display_name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, partnerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time: append new messages from the WebSocket (subscribe to dm:{dmId} like league chat does with league:{id})
  useGatewayTopic(
    dmId ? SleeperTopics.dm(dmId) : null,
    useCallback((event: string, payload: unknown) => {
      if (event === "message_created") {
        const p = payload as MessageCreatedPayload;
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === p.message_id)) return prev;
          return [...prev, messageFromSocket(p)];
        });
        onNewMessageRef.current?.(p.text || "Attachment", p.created, p.author_display_name);
      }
    }, []),
  );

  const sendMessage = useCallback(async () => {
    const text = inputRef.current?.value.trim();
    if (!text || !dmId || sendingRef.current) return;
    setSending(true);
    setError(null);
    try {
      await window.ipc.invoke("message:create", {
        parent_id: dmId,
        text,
        k_attachment_data: [],
        v_attachment_data: [],
      });
      if (inputRef.current) inputRef.current.value = "";
      onNewMessage?.(text, Date.now(), "You");
      await fetchMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [dmId, fetchMessages, onNewMessage]);

  const sorted = useMemo(() => [...messages].sort((a, b) => a.created - b.created), [messages]);

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
                {msg.text && <p className="text-xs text-gray-200 whitespace-pre-wrap">{cleanText(msg.text)}</p>}
                {att && <AttachmentView attachment={att} leagues={leagues} messages={sorted} />}
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
          ref={inputRef}
          type="text"
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
          disabled={!dmId || sending}
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
});

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
  leagues: { [league_id: string]: LeagueDetailed } | undefined,
  leagueId: string | undefined,
) {
  const league = leagues && leagueId ? leagues[leagueId] : undefined;
  let order: number | null = null;
  if (league && pk.roster_id && pk.season && pk.round) {
    const rid = Number(pk.roster_id);
    const season = String(pk.season);
    const round = Number(pk.round);
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

  // Also check the pick's own order field from the attachment
  if (!order && pk.order != null) {
    const parsed = typeof pk.order === "string" ? parseInt(pk.order, 10) : pk.order;
    if (parsed && parsed > 0) order = parsed;
  }

  if (order) {
    return `${pk.season} ${pk.round}.${String(order).padStart(2, "0")}`;
  }
  const originalOwnerId = pk.original_owner_id;
  if (originalOwnerId && originalOwnerId !== ownerRid && league) {
    const origRoster = league.rosters.find((r) => r.user_id === originalOwnerId);
    if (origRoster?.username) {
      return `${pk.season} Round ${pk.round} (${origRoster.username})`;
    }
  }
  return `${pk.season} Round ${pk.round}`;
}

export function AttachmentView({ attachment, leagues, messages, leagueId: propLeagueId }: { attachment: Record<string, unknown>; leagues?: { [league_id: string]: LeagueDetailed }; messages?: Message[]; leagueId?: string }) {
  // If this is a notification referencing another message (e.g. trade proposal), resolve it
  const refMessageId = attachment.messageId as string | number | undefined;
  if (refMessageId && messages) {
    const refMsg = messages.find((m) => m.message_id === String(refMessageId));
    if (refMsg?.attachment) {
      const refAtt = parseAttachment(refMsg.attachment);
      if (refAtt) {
        return <AttachmentView attachment={refAtt} leagues={leagues} messages={messages} leagueId={propLeagueId} />;
      }
    }
  }

  // Handle league chat "transactions" wrapper: { data: [{ transactions_by_roster, ... }] }
  const dataArray = attachment.data as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(dataArray) && dataArray.length > 0 && dataArray[0].transactions_by_roster) {
    return <AttachmentView attachment={dataArray[0]} leagues={leagues} messages={messages} leagueId={propLeagueId ?? attachment.league_id as string} />;
  }

  const txByRoster = attachment.transactions_by_roster as Record<string, RosterTransaction> | undefined;
  const leagueId = propLeagueId ?? attachment.league_id as string | undefined;
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
                    + {formatPickLabel(pk, rid, leagues, leagueId)}
                  </div>
                ))}
                {droppedPicks.map((pk, i) => (
                  <div key={`dp${i}`} className="text-xs text-orange-400 ml-2">
                    − {formatPickLabel(pk, rid, leagues, leagueId)}
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
        {Array.isArray(choices) && (
          <div className="flex flex-col gap-0.5 mt-1">
            {choices.map((c, i) => (
              <span key={i} className="text-xs text-gray-400">• {String(c)}</span>
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

  // Nickname changes: { changes: [{ nickname, player: { first_name, last_name, position, team } }] }
  const changes = attachment.changes as Array<{ nickname?: string; player?: { first_name?: string; last_name?: string; position?: string; team?: string } }> | undefined;
  if (Array.isArray(changes) && changes.length > 0) {
    return (
      <div className="mt-1 rounded bg-gray-800 px-2 py-1.5">
        <div className="flex flex-col gap-0.5 mt-0.5">
          {changes.map((c, i) => (
            <div key={i} className="text-xs text-gray-300 ml-1">
              <span className="text-gray-400">{c.player?.first_name} {c.player?.last_name}</span>
              {c.player?.position && <span className="text-gray-500 text-[10px] ml-1">{c.player.position} - {c.player.team}</span>}
              {c.nickname && <span className="text-blue-400 ml-1.5">&rarr; &ldquo;{c.nickname}&rdquo;</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Trade notification or other text-bearing attachment (no trade details available)
  const attText = attachment.text as string | undefined;
  if (attText) {
    return (
      <div className="mt-1 rounded bg-gray-800 px-2 py-1.5">
        <p className="text-xs text-gray-400 mt-0.5 italic">{cleanText(attText)}</p>
      </div>
    );
  }

  // Fallback: hide unknown attachments silently (no raw JSON dump)
  return null;
}
