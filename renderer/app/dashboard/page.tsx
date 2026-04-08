"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useLeagues } from "../../hooks/use-leagues";

const SEASON = "2026";

export default function DashboardPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, loading, error } = useLeagues({
    user_id: session?.user_id,
    season: SEASON,
  });

  useEffect(() => {
    if (!session?.token || !session?.user_id) {
      router.push("/home");
    }
  }, [session?.token, session?.user_id, router]);

  if (!session?.user_id) return null;

  console.log("Leagues data:", data);

  const user = data ? data.user : null;
  const leagues = data ? Object.values(data.leagues) : [];

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-3xl font-bold">{user?.display_name}</h1>

      {loading && <p className="text-gray-400">Loading leagues…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && leagues.length === 0 && (
        <p className="text-gray-400">No leagues found for {SEASON}.</p>
      )}

      <ul className="flex w-full max-w-2xl flex-col gap-2">
        {leagues
          .sort((a, b) => a.index - b.index)
          .map((league) => (
            <li
              key={league.league_id}
              className="rounded bg-gray-900 p-4 text-gray-100"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{league.name}</span>
                <span className="text-xs text-gray-400">
                  {league.user_roster.wins}-{league.user_roster.losses}
                  {league.user_roster.ties > 0 && `-${league.user_roster.ties}`}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {league.rosters.length} teams · {league.season}
              </div>
            </li>
          ))}
      </ul>

      {data && (
        <p className="text-xs text-gray-500">
          Updated {new Date(data.updated_at).toLocaleTimeString()}
        </p>
      )}
    </main>
  );
}
