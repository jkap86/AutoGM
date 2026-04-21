import { useCallback, useEffect, useState } from "react";
import type { Message, MessagesResult, CreateMessageResult } from "@sleepier/shared";
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

export function LeagueChatPanel({
  userId,
  leagueId,
  leagueName,
}: {
  userId: string;
  leagueId: string;
  leagueName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.ipc.invoke<MessagesResult>("graphql", {
        name: "messages",
        vars: { parent_id: leagueId },
      });
      setMessages(result.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await window.ipc.invoke<CreateMessageResult>("graphql", {
        name: "createLeagueMessage",
        vars: { parent_id: leagueId, text },
      });
      setDraft("");
      await fetchMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [draft, sending, leagueId, fetchMessages]);

  const sorted = [...messages].sort((a, b) => a.created - b.created);

  return (
    <div className="flex flex-col">
      {/* Messages area */}
      <div className="flex flex-col gap-1 px-4 py-3 max-h-72 overflow-y-auto flex-col-reverse">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <span className="text-xs text-gray-500">Loading league chat...</span>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={fetchMessages} className="text-xs text-gray-400 hover:text-gray-200 underline">Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <span className="text-xs text-gray-500">No messages in {leagueName}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sorted.map((msg) => {
              const isUser = msg.author_id === userId;
              return (
                <div key={msg.message_id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-1.5 ${isUser ? "bg-blue-600/20" : "bg-gray-700/60"}`}>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold ${isUser ? "text-blue-400" : "text-gray-300"}`}>
                        {msg.author_display_name}
                      </span>
                      <span className="text-[9px] text-gray-600">{formatTime(msg.created)}</span>
                    </div>
                    {msg.text && <p className="text-xs text-gray-200 whitespace-pre-wrap">{decodeHtmlEntities(msg.text)}</p>}
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
          placeholder={`Message ${leagueName}...`}
          disabled={sending}
          className="flex-1 rounded bg-gray-900 border border-gray-700 px-2.5 py-1.5 text-xs text-gray-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || sending}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
      {error && messages.length > 0 && (
        <div className="px-4 pb-2">
          <span className="text-[10px] text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}
