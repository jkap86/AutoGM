import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeagueDetailed, Message, MessagesResult, CreateMessageResult, MessageCreatedPayload } from "@autogm/shared";
import { SleeperTopics, messageFromSocket } from "@autogm/shared";
import { useGatewayTopic } from "../../../contexts/socket-context";
import { Avatar } from "../../components/avatar";
import { formatTime } from "../../../lib/trade-utils";
import { parseAttachment, AttachmentView, cleanText } from "./dm-panel";
import { MessageBubble } from "../../components/message-bubble";

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY || 'AIzaSyC-P6RbEhWxUhtjTAANbYz4WB-YGlavnD0';

type SortMode = "original" | "alpha" | "recent";

// Module-level cache so previews survive tab switches (cleared after 10 min)
const CHAT_CACHE_TTL = 10 * 60 * 1000;
let previewCache: Record<string, Message> = {};
let timeCache: Record<string, number> = {};
const fetchedLeagues = new Set<string>();
let chatCacheCreatedAt = Date.now();
function checkChatCacheTTL() {
  if (Date.now() - chatCacheCreatedAt > CHAT_CACHE_TTL) {
    previewCache = {};
    timeCache = {};
    fetchedLeagues.clear();
    chatCacheCreatedAt = Date.now();
  }
}

export function LeagueChatsPanel({
  leagues,
  userId,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  userId: string;
}) {
  checkChatCacheTTL();
  const [sortMode, setSortMode] = useState<SortMode>("original");
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, number>>(timeCache);
  const [previews, setPreviews] = useState<Record<string, Message>>(previewCache);

  const leagueList = useMemo(() => Object.values(leagues), [leagues]);

  // Fetch previews for leagues not yet cached, in batches of 4
  useEffect(() => {
    const unfetched = leagueList.filter((l) => !fetchedLeagues.has(l.league_id));
    if (unfetched.length === 0) return;

    let cancelled = false;
    (async () => {
      const batch = 4;
      for (let i = 0; i < unfetched.length; i += batch) {
        if (cancelled) break;
        const chunk = unfetched.slice(i, i + batch);
        const results = await Promise.allSettled(
          chunk.map((league) =>
            window.ipc.invoke<MessagesResult>("graphql", {
              name: "messages",
              vars: { parent_id: league.league_id },
            }).then((r) => ({ league_id: league.league_id, messages: r.messages ?? [] }))
          ),
        );
        if (cancelled) break;
        const newPreviews: Record<string, Message> = {};
        const newTimes: Record<string, number> = {};
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          fetchedLeagues.add(r.value.league_id);
          if (r.value.messages.length === 0) continue;
          const latest = r.value.messages.reduce((a, b) => (a.created > b.created ? a : b));
          newPreviews[r.value.league_id] = latest;
          newTimes[r.value.league_id] = latest.created;
          previewCache[r.value.league_id] = latest;
          timeCache[r.value.league_id] = latest.created;
        }
        setPreviews((prev) => ({ ...prev, ...newPreviews }));
        setLastMessageTimes((prev) => ({ ...prev, ...newTimes }));
      }
    })();
    return () => { cancelled = true; };
  }, [leagueList]);

  const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);

  const computedSort = useMemo(() => {
    const list = [...leagueList];
    switch (sortMode) {
      case "alpha":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "recent":
        return list.sort((a, b) => (lastMessageTimes[b.league_id] ?? 0) - (lastMessageTimes[a.league_id] ?? 0));
      default:
        return list;
    }
  }, [leagueList, sortMode, lastMessageTimes]);

  // Freeze sort order while a card is expanded
  const frozenRef = useRef(computedSort);
  if (!expandedLeagueId) frozenRef.current = computedSort;
  const sortedLeagues = expandedLeagueId ? frozenRef.current : computedSort;

  const updateLastMessage = useCallback((leagueId: string, time: number) => {
    setLastMessageTimes((prev) => {
      if (prev[leagueId] === time) return prev;
      return { ...prev, [leagueId]: time };
    });
  }, []);

  if (leagueList.length === 0) {
    return <p className="text-gray-400 text-center py-8">No leagues loaded.</p>;
  }

  return (
    <div className="w-full max-w-4xl flex flex-col gap-3">
      {/* Sort controls */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mr-1.5">Sort</span>
        {([
          { mode: "original" as SortMode, label: "Default" },
          { mode: "alpha" as SortMode, label: "A-Z" },
          { mode: "recent" as SortMode, label: "Recent" },
        ]).map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              sortMode === mode
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "bg-gray-700/60 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* League chat cards */}
      {sortedLeagues.map((league) => (
        <LeagueChatCard
          key={league.league_id}
          league={league}
          leagues={leagues}
          userId={userId}
          onLastMessage={updateLastMessage}
          previewMessage={previews[league.league_id] ?? null}
          expanded={expandedLeagueId === league.league_id}
          onToggleExpand={() => setExpandedLeagueId((prev) => prev === league.league_id ? null : league.league_id)}
        />
      ))}
    </div>
  );
}

// Common emoji categories for quick picker
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😂", "🤣", "😭", "💀", "🔥", "❤️", "😤", "😈", "🥶", "🤡", "😎", "🤔", "😏", "🙄", "😬", "🫠", "💯", "👀", "🤝", "👏"] },
  { label: "Sports", emojis: ["🏈", "🏆", "🥇", "🥈", "🥉", "📈", "📉", "💰", "🎯", "⚡", "🚀", "💪", "🧠", "👑", "🐐", "🗑️", "💩", "🤮", "🫡", "🍻"] },
  { label: "Reactions", emojis: ["👍", "👎", "🤷", "🙏", "✅", "❌", "⁉️", "‼️", "⚠️", "🚨", "📢", "🔔", "💤", "🎉", "🥳", "😢", "😡", "🤦", "💔", "🫣"] },
];

// Tenor GIF search result type
type TenorGif = {
  id: string;
  title: string;
  media_formats: {
    tinygif?: { url: string };
    gif?: { url: string };
    mp4?: { url: string };
    tinymp4?: { url: string };
  };
};

function GifPicker({ onSelect, onClose }: { onSelect: (gif: TenorGif) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenorGif[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search using Sleeper's own GIF proxy or Tenor directly
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      // Use Tenor v2 API with the default Sleeper key or a free key
      const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,tinymp4`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Load trending on mount
  useEffect(() => {
    (async () => {
      try {
        const url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyC-P6RbEhWxUhtjTAANbYz4WB-YGlavnD0&limit=20&media_filter=tinygif,tinymp4`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-20 max-h-72 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/60">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="flex-1 rounded bg-gray-800 border border-gray-700/60 px-2 py-1 text-xs text-gray-200 focus:border-blue-500/50 focus:outline-none"
        />
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-1.5 min-h-0">
        {searching && results.length === 0 && (
          <span className="col-span-3 text-center text-xs text-gray-500 py-4">Searching...</span>
        )}
        {results.map((gif) => {
          const preview = gif.media_formats.tinygif?.url ?? gif.media_formats.gif?.url;
          if (!preview) return null;
          return (
            <button
              key={gif.id}
              onClick={() => onSelect(gif)}
              className="rounded overflow-hidden hover:ring-2 hover:ring-blue-500 transition"
            >
              <img src={preview} alt={gif.title} className="w-full h-16 object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-20 w-64 max-h-52 flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700/60">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Emoji</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
      </div>
      <div className="overflow-y-auto p-2 flex flex-col gap-2">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <span className="text-[10px] text-gray-500 font-medium">{cat.label}</span>
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {cat.emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => onSelect(e)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700/60 text-base transition"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeagueChatCard({
  league,
  leagues,
  userId,
  onLastMessage,
  previewMessage,
  expanded,
  onToggleExpand,
}: {
  league: LeagueDetailed;
  leagues: { [league_id: string]: LeagueDetailed };
  userId: string;
  onLastMessage: (leagueId: string, time: number) => void;
  previewMessage: Message | null;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sendingRef = useRef(sending);
  sendingRef.current = sending;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.ipc.invoke<MessagesResult>("graphql", {
        name: "messages",
        vars: { parent_id: league.league_id },
      });
      const msgs = result.messages ?? [];
      setMessages(msgs);
      if (msgs.length > 0) {
        const latest = Math.max(...msgs.map((m) => m.created));
        onLastMessage(league.league_id, latest);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [league.league_id, onLastMessage]);

  // Only fetch messages when the card is expanded (avoid stampeding all leagues at once)
  const hasFetched = useRef(false);
  useEffect(() => {
    if (expanded && !hasFetched.current) {
      hasFetched.current = true;
      fetchMessages();
    }
  }, [expanded, fetchMessages]);

  // Real-time: append new messages from the WebSocket
  useGatewayTopic(
    SleeperTopics.league(league.league_id),
    useCallback((event: string, payload: unknown) => {
      if (event === "message_created") {
        const p = payload as MessageCreatedPayload;
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === p.message_id)) return prev;
          return [...prev, messageFromSocket(p)];
        });
        onLastMessage(league.league_id, p.created);
      }
    }, [league.league_id, onLastMessage]),
  );

  // Autoscroll to bottom of chat container only (not the whole page)
  useEffect(() => {
    if (expanded && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [expanded, messages]);

  const sendMessage = useCallback(async () => {
    const text = draftRef.current.trim();
    if (!text || sendingRef.current) return;
    setSending(true);
    setError(null);
    try {
      await window.ipc.invoke<CreateMessageResult>("league-message:create", {
        parent_id: league.league_id,
        text,
      });
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [league.league_id]);

  const sendGif = useCallback(async (gif: TenorGif) => {
    if (sendingRef.current) return;
    setSending(true);
    setShowGifPicker(false);
    setError(null);
    try {
      const mp4Url = gif.media_formats.tinymp4?.url ?? gif.media_formats.mp4?.url ?? "";
      const gifUrl = gif.media_formats.tinygif?.url ?? gif.media_formats.gif?.url ?? "";
      await window.ipc.invoke<CreateMessageResult>("league-message:create", {
        parent_id: league.league_id,
        text: "",
        attachment_type: "gif",
        k_attachment_data: ["original_mp4", "original_still", "fixed_height_mp4", "fixed_height_still"],
        v_attachment_data: [mp4Url, gifUrl, mp4Url, gifUrl],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [league.league_id]);

  const insertEmoji = useCallback((emoji: string) => {
    setDraft((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.created - b.created),
    [messages],
  );

  const typeLabel =
    league.settings.type === 2 ? "Dynasty"
    : league.settings.type === 1 ? "Keeper"
    : "Redraft";

  const lastMsg = sorted.length > 0 ? sorted[sorted.length - 1] : previewMessage;

  return (
    <div className="rounded-xl border border-gray-700/80 bg-gray-800 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-gray-700/30 transition"
        onClick={onToggleExpand}
      >
        <Avatar hash={league.avatar} alt={league.name} size={24} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-200 truncate" title={league.name}>
            {league.name}
          </span>
          <span className="text-xs text-gray-500">
            {league.season} · {typeLabel} · {league.rosters.length} teams
          </span>
        </div>
        {/* Preview of last message */}
        {!expanded && lastMsg && (
          <div className="hidden sm:flex items-center gap-2 max-w-[40%] min-w-0">
            <span className="text-xs text-gray-500 truncate">
              <span className="font-medium text-gray-400">{lastMsg.author_display_name}:</span>{" "}
              {lastMsg.text ? cleanText(lastMsg.text).slice(0, 60) : "..."}
            </span>
            <span className="text-[10px] text-gray-600 shrink-0">{formatTime(lastMsg.created)}</span>
          </div>
        )}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Chat area */}
      {expanded && (
        <div className="border-t border-gray-700/40 flex flex-col">
          {/* Messages */}
          <div ref={scrollContainerRef} className="flex flex-col gap-1 px-4 py-3 max-h-80 overflow-y-auto">
            {loading && messages.length === 0 ? (
              <div className="flex justify-center py-6">
                <span className="text-xs text-gray-500">Loading chat...</span>
              </div>
            ) : error && messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <span className="text-xs text-red-400">{error}</span>
                <button onClick={fetchMessages} className="text-xs text-gray-400 hover:text-gray-200 underline">Retry</button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex justify-center py-6">
                <span className="text-xs text-gray-500">No messages yet</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {sorted.map((msg) => {
                  const isUser = msg.author_id === userId;
                  const att = parseAttachment(msg.attachment);
                  return (
                    <MessageBubble key={msg.message_id} msg={msg} isUser={isUser} parentId={league.league_id}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className={`text-xs font-semibold ${isUser ? "text-blue-400" : "text-gray-300"}`}>
                          {msg.author_display_name}
                        </span>
                        <span className="text-xs text-gray-600">{formatTime(msg.created)}</span>
                      </div>
                      {msg.text && <p className="text-xs text-gray-200 whitespace-pre-wrap">{cleanText(msg.text)}</p>}
                      {att && <AttachmentView attachment={att} leagues={leagues} messages={sorted} leagueId={league.league_id} />}
                    </MessageBubble>
                  );
                })}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="relative border-t border-gray-700/40 px-4 py-2">
            {showGifPicker && <GifPicker onSelect={sendGif} onClose={() => setShowGifPicker(false)} />}
            {showEmojiPicker && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmojiPicker(false)} />}
            <div className="flex items-center gap-1.5">
              {/* Emoji button */}
              <button
                onClick={() => { setShowEmojiPicker((p) => !p); setShowGifPicker(false); }}
                className="shrink-0 rounded p-1.5 text-gray-500 hover:text-yellow-400 hover:bg-gray-700/40 transition"
                title="Emoji"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
              </button>
              {/* GIF button */}
              <button
                onClick={() => { setShowGifPicker((p) => !p); setShowEmojiPicker(false); }}
                className="shrink-0 rounded px-1.5 py-1 text-[10px] font-bold text-gray-500 hover:text-purple-400 hover:bg-gray-700/40 border border-gray-600/50 transition"
                title="GIF"
              >
                GIF
              </button>
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
                placeholder={`Message ${league.name}...`}
                disabled={sending}
                className="flex-1 rounded bg-gray-900 border border-gray-700 px-2.5 py-1.5 text-xs text-gray-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim() || sending}
                className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
          {error && messages.length > 0 && (
            <div className="px-4 pb-2">
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
