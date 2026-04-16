"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useLeagues } from "../../hooks/use-leagues";
import TradesView from "../views/trades";
import { useAllPlayers } from "../../hooks/use-allplayers";
import PollsView from "../views/polls-view";
import AdpView from "../views/adp-view";
import { LeagueFilterBar, useLeagueFilter } from "../components/league-filter";
import { useKtc } from "../../hooks/use-ktc";

const SEASON = "2026";

type View = "trades" | "polls" | "adp" | null;

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
  const { filters, setFilters, filteredLeagues } = useLeagueFilter(leagues);
  const { ktc } = useKtc();

  const views = ["trades", "polls", "adp"];

  useEffect(() => {
    if (!session?.token || !session?.user_id) {
      router.push("/home");
    }
  }, [session?.token, session?.user_id, router]);

  if (!session?.user_id) return null;

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-3xl font-bold">{user?.display_name}</h1>

      {allPlayersLoading && <p className="text-gray-400">Loading players…</p>}
      {loading && <p className="text-gray-400">Loading leagues…</p>}
      {allPlayersError && (
        <p className="text-sm text-red-400">{allPlayersError}</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && leagues && (
        <LeagueFilterBar
          filters={filters}
          setFilters={setFilters}
          totalCount={Object.keys(leagues).length}
          filteredCount={Object.keys(filteredLeagues).length}
        />
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
          allplayers={allplayers ?? {}}
          leagues={filteredLeagues}
          playerShares={playerShares}
          leaguemates={leaguemates}
          pickShares={pickShares}
          userId={session.user_id}
          ktc={ktc}
        />
      ) : view === "polls" ? (
        <PollsView leagues={filteredLeagues} />
      ) : view === "adp" ? (
        <AdpView allplayers={allplayers ?? {}} />
      ) : (
        <p className="text-gray-400">Select a view above.</p>
      )}
    </main>
  );
}
