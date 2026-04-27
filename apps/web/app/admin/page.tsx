"use client";

import { useCallback, useEffect, useState } from "react";

type AllowedUser = {
  user_id: string;
  display_name: string;
  avatar: string | null;
};

// Admin user ID is entered on the page — validated server-side against ADMIN_USER_ID env var

export default function AdminPage() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addInput, setAddInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resolvedUser, setResolvedUser] = useState<AllowedUser | null>(null);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);

  const headers = { "x-admin-password": password };

  const fetchUsers = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/allowlist", { headers: { "x-admin-password": password } });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [password]);

  const resolveUser = async () => {
    const input = addInput.trim();
    if (!input) return;
    setResolving(true);
    setResolvedUser(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/resolve-user?username=${encodeURIComponent(input)}`, { headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "User not found");
      }
      const data = await res.json();
      setResolvedUser(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setResolving(false);
    }
  };

  const addUser = async (userId: string) => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setAddInput("");
      setResolvedUser(null);
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  const removeUser = async (userId: string) => {
    if (!confirm("Remove this user from the allowlist?")) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6">
          <h1 className="text-xl font-bold mb-4 text-center">Admin Login</h1>
          {error && (
            <div className="mb-3 rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") fetchUsers(); }}
            placeholder="Admin password..."
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none mb-3"
          />
          <button
            onClick={fetchUsers}
            disabled={loading || !password.trim()}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {loading ? "Checking..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin - Allowlist</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Add user */}
        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Add User</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={addInput}
              onChange={(e) => { setAddInput(e.target.value); setResolvedUser(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") resolveUser(); }}
              placeholder="Sleeper username or user_id..."
              className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={resolveUser}
              disabled={resolving || !addInput.trim()}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50 transition"
            >
              {resolving ? "..." : "Lookup"}
            </button>
          </div>

          {resolvedUser && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-800/60 px-4 py-3">
              {resolvedUser.avatar && (
                <img
                  src={`https://sleepercdn.com/avatars/thumbs/${resolvedUser.avatar}`}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200">{resolvedUser.display_name}</p>
                <p className="text-xs text-gray-500 font-mono">{resolvedUser.user_id}</p>
              </div>
              <button
                onClick={() => addUser(resolvedUser.user_id)}
                disabled={adding || users.some((u) => u.user_id === resolvedUser.user_id)}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition"
              >
                {users.some((u) => u.user_id === resolvedUser.user_id) ? "Already added" : adding ? "Adding..." : "Add"}
              </button>
            </div>
          )}
        </div>

        {/* Current users */}
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Allowed Users ({users.length})
            </h2>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 py-4 text-center">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No users in allowlist</p>
          ) : (
            <div className="flex flex-col gap-1">
              {users.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-800/60 transition group"
                >
                  {user.avatar ? (
                    <img
                      src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                      alt=""
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                      ?
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{user.display_name}</p>
                    <p className="text-[11px] text-gray-500 font-mono">{user.user_id}</p>
                  </div>
                  <button
                    onClick={() => removeUser(user.user_id)}
                    className="opacity-0 group-hover:opacity-100 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-600/20 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
