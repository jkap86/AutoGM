"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useLeagues } from "../../hooks/use-leagues";
import TransactionsView from "../views/trades";
import WaiversDesktopView from "../views/trades/waivers-view";
import { useAllPlayers } from "../../hooks/use-allplayers";
import ResearchView from "../views/research-view";
import LeaguesView from "../views/leagues-view";
import DraftsView from "../views/drafts-view";
import { LeagueFilterBar, useLeagueFilter } from "../components/league-filter";
import { useKtc } from "../../hooks/use-ktc";
import { useLeaguePlayers } from "../../hooks/use-league-players";
import { useTradeValueFilter } from "../../hooks/use-trade-value-filter";
import { CURRENT_SEASON, SleeperTopics } from "@autogm/shared";
import { useGatewayTopic, useSocketContext } from "../../contexts/socket-context";

const SEASON = CURRENT_SEASON;

type View = "leagues" | "dms" | "drafts" | "research";

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
  const [view, setView] = useState<View>("leagues");
  const { filters, setFilters, filteredLeagues } = useLeagueFilter(leagues);
  const { ktc } = useKtc();

  const { interestByLeague, tradeBlockByLeague } = useLeaguePlayers(leagues);
  const valueFilter = useTradeValueFilter({ leagues: filteredLeagues, allplayers: allplayers ?? {}, ktc });
  const { gatewayStatus } = useSocketContext();

  // Subscribe to user-level events (mentions, notifications, trade updates)
  useGatewayTopic(
    session?.user_id ? SleeperTopics.user(session.user_id) : null,
    () => {},
  );

  const views = ["leagues", "dms", "drafts", "research"];

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
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">{user?.display_name}</h1>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            gatewayStatus === 'connected'
              ? 'bg-green-500'
              : gatewayStatus === 'connecting'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
          }`}
          title={`Socket: ${gatewayStatus}`}
        />
      </div>

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

      {view === "leagues" ? (
        <LeaguesView
          leagues={filteredLeagues}
          userId={session.user_id}
          filter={valueFilter}
          tradesView={
            <TransactionsView
              allplayers={allplayers ?? {}}
              leagues={filteredLeagues}
              playerShares={playerShares}
              leaguemates={leaguemates}
              pickShares={pickShares}
              userId={session.user_id}
              ktc={ktc}
              interestByLeague={interestByLeague}
              tradeBlockByLeague={tradeBlockByLeague}
              hideSubTabs
            />
          }
          waiversView={
            <WaiversDesktopView
              leagues={filteredLeagues}
              allplayers={allplayers ?? {}}
              userId={session.user_id}
              ktc={ktc}
              playerShares={playerShares}
            />
          }
        />
      ) : view === "dms" ? (
        <TransactionsView
          allplayers={allplayers ?? {}}
          leagues={filteredLeagues}
          playerShares={playerShares}
          leaguemates={leaguemates}
          pickShares={pickShares}
          userId={session.user_id}
          ktc={ktc}
          interestByLeague={interestByLeague}
          tradeBlockByLeague={tradeBlockByLeague}
          initialTab="dms"
          hideSubTabs
        />
      ) : view === "drafts" ? (
        <DraftsView
          leagues={filteredLeagues}
          allplayers={allplayers ?? {}}
          userId={session.user_id}
        />
      ) : (
        <ResearchView
          leagues={filteredLeagues}
          allplayers={allplayers ?? {}}
          ktc={ktc}
          userId={session.user_id}
        />
      )}
    </main>
  );
}
