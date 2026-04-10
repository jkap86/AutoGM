"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useLeagues } from "../../hooks/use-leagues";
import TradesView from "../views/trades-view";
import { useAllPlayers } from "../../hooks/use-allplayers";

const SEASON = "2026";

type View = "trades" | null;

export default function DashboardPage() {
  const router = useRouter();
  const { session } = useAuth();
  const {
    allplayers,
    loading: allPlayersLoading,
    error: allPlayersError,
  } = useAllPlayers();
  const {
    user,
    leagues,
    loading,
    error,
    playerShares,
    leaguemates,
    pickShares,
  } = useLeagues({
    user_id: session?.user_id,
    season: SEASON,
  });
  const [view, setView] = useState<View>(null);

  const views = ["trades", "players", "lineups"];

  useEffect(() => {
    if (!session?.token || !session?.user_id) {
      router.push("/home");
    }
  }, [session?.token, session?.user_id, router]);

  if (!session?.user_id) return null;

  console.log({ allplayers });

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-3xl font-bold">{user?.display_name}</h1>

      {allPlayersLoading && <p className="text-gray-400">Loading players…</p>}
      {loading && <p className="text-gray-400">Loading leagues…</p>}
      {allPlayersError && (
        <p className="text-sm text-red-400">{allPlayersError}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <p className="text-gray-400">
          {Object.keys(leagues || {}).length} Leagues for {SEASON}.
        </p>
      )}

      <div className="flex gap-4 justify-center">
        {views.map((v) => (
          <button
            key={v}
            className={`py-2 px-4 rounded-[1rem] ${
              view === v ? "bg-blue-600" : "bg-gray-300 text-black"
            }`}
            onClick={() => setView(v as View)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {view === "trades" ? (
        <TradesView
          allplayers={allplayers || {}}
          leagues={leagues || {}}
          playerShares={playerShares}
          leaguemates={leaguemates}
          pickShares={pickShares}
        />
      ) : (
        <p className="text-gray-400">Select a view above.</p>
      )}
    </main>
  );
}
