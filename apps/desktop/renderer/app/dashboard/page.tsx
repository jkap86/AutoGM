"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useLeagues } from "../../hooks/use-leagues";
import TradesView from "../views/trades";
import { useAllPlayers } from "../../hooks/use-allplayers";
import PollsView from "../views/polls-view";
import AdpView from "../views/adp-view";
import { LeagueChatsPanel } from "../views/trades/league-chats-panel";
import { LeagueFilterBar, useLeagueFilter } from "../components/league-filter";
import { useKtc } from "../../hooks/use-ktc";
import { useLeaguePlayers } from "../../hooks/use-league-players";
import { CURRENT_SEASON } from "@autogm/shared";

const SEASON = CURRENT_SEASON;

type View = "trades" | "polls" | "adp" | "chats" | null;

export default function DashboardPage() {
  const router = useRouter();
  const { session, accessAllowed, restoring } = useAuth();
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

  const { interestByLeague, tradeBlockByLeague } = useLeaguePlayers(leagues);

  const views = ["trades", "polls", "adp", "chats"];

  useEffect(() => {
    if (restoring) return;
    if (!session?.token || !session?.user_id) {
      router.push("/home");
    } else if (accessAllowed === false) {
      router.push("/access-denied");
    }
  }, [restoring, session?.token, session?.user_id, accessAllowed, router]);

  if (restoring || !session?.user_id || accessAllowed === null) return null;
  if (!accessAllowed) return null;

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

      <div className="flex gap-2 justify-center">
        {views.map((v) => (
          <button
            key={v}
            className={`py-2 px-5 rounded-lg text-sm font-medium transition ${
              view === v
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
            aria-pressed={view === v}
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
          interestByLeague={interestByLeague}
          tradeBlockByLeague={tradeBlockByLeague}
        />
      ) : view === "polls" ? (
        <PollsView leagues={filteredLeagues} />
      ) : view === "adp" ? (
        <AdpView allplayers={allplayers ?? {}} />
      ) : view === "chats" ? (
        <LeagueChatsPanel
          leagues={filteredLeagues}
          userId={session.user_id}
        />
      ) : (
        <p className="text-gray-400">Select a view above.</p>
      )}
    </main>
  );
}
