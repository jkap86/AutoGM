import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Allplayer,
  LeagueDetailed,
  Leaguemates,
  PickShares,
  PlayerShares,
  Roster,
} from "../../../main/lib/types";
import { usePendingTrades, type PendingTrade } from "../../hooks/use-pending-trades";

type TradesTab = "create" | "pending";

function buildPlayerAttachment(p: Allplayer | undefined) {
  if (!p) return { player_id: "0" };
  return {
    position: p.position,
    first_name: p.first_name,
    last_name: p.last_name,
    sport: "nfl",
    team: p.team,
    player_id: p.player_id,
    fantasy_positions: p.fantasy_positions,
    years_exp: p.years_exp,
  };
}

function buildUserAttachment(roster: Roster, league_id: string) {
  return {
    avatar: roster.avatar,
    display_name: roster.username,
    is_bot: false,
    is_owner: null,
    league_id,
    metadata: {},
    settings: null,
    user_id: roster.user_id,
  };
}
import { getPickId } from "../../lib/leagues";
import { ProposeTradeVars } from "../../../main/graphql/queries/types";
import { useIpcMutation } from "../../hooks/use-ipc-mutation";

export default function TradesView({
  leagues,
  playerShares,
  leaguemates,
  pickShares,
  allplayers,
}: {
  leagues: {
    [league_id: string]: LeagueDetailed;
  };
  playerShares: PlayerShares;
  leaguemates: Leaguemates;
  pickShares: PickShares;
  allplayers: {
    [player_id: string]: Allplayer;
  };
}) {
  const [playersToGive, setPlayerstoGive] = useState<string[]>([]);
  const [playersToReceive, setPlayersToReceive] = useState<string[]>([]);
  const [picksToGive, setPicksToGive] = useState<string[]>([]);
  const [picksToReceive, setPicksToReceive] = useState<string[]>([]);
  const [selectedProposals, setSelectedProposals] = useState<
    (ProposeTradeVars & { user_id: string })[]
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  useEffect(() => {
    setSelectedProposals([]);
  }, [playersToGive, playersToReceive, picksToGive, picksToReceive]);

  const { mutate: proposeTrade } = useIpcMutation("proposeTrade");
  const { mutate: getDm } = useIpcMutation("getDmByMembers");
  const { mutate: sendMessage } = useIpcMutation("createMessage");

  const submitProposals = useCallback(async () => {
    if (selectedProposals.length === 0) return;
    setSubmitting(true);
    setSubmitProgress(0);
    for (let i = 0; i < selectedProposals.length; i++) {
      const { user_id, ...vars } = selectedProposals[i];
      try {
        const result = await proposeTrade(vars);
        const transaction = result.propose_trade;

        const league = leagues[vars.league_id];
        const partnerRoster = league?.rosters.find(
          (r) => r.user_id === user_id,
        );

        if (league && partnerRoster) {
          const userRoster = league.user_roster;

          // Build transactions_by_roster — keyed by roster_id
          const transactionsByRoster: Record<string, unknown> = {
            [userRoster.roster_id]: {
              adds: playersToGive.map((pid) =>
                buildPlayerAttachment(allplayers[pid]),
              ),
              drops: [],
              added_picks: picksToGive.flatMap((pickId) => {
                const pick = userRoster.draftpicks.find(
                  (d) => getPickId(d) === pickId,
                );
                if (!pick) return [];
                return [
                  {
                    roster_id: String(pick.roster_id),
                    season: pick.season,
                    round: String(pick.round),
                    owner_id: userRoster.user_id,
                    previous_owner_id: partnerRoster.user_id,
                    original_owner_id: pick.original_user.user_id,
                  },
                ];
              }),
              dropped_picks: [],
              added_budget: [],
              dropped_budget: [],
              status: "proposed",
              user: buildUserAttachment(userRoster, league.league_id),
            },
            [partnerRoster.roster_id]: {
              adds: playersToReceive.map((pid) =>
                buildPlayerAttachment(allplayers[pid]),
              ),
              drops: [],
              added_picks: picksToReceive.flatMap((pickId) => {
                const pick = partnerRoster.draftpicks.find(
                  (d) => getPickId(d) === pickId,
                );
                if (!pick) return [];
                return [
                  {
                    roster_id: String(pick.roster_id),
                    season: pick.season,
                    round: String(pick.round),
                    owner_id: partnerRoster.user_id,
                    previous_owner_id: userRoster.user_id,
                    original_owner_id: pick.original_user.user_id,
                  },
                ];
              }),
              dropped_picks: [],
              added_budget: [],
              dropped_budget: [],
              status: "proposed",
              user: buildUserAttachment(partnerRoster, league.league_id),
            },
          };

          // Build users_in_league_map — all users in this league
          const usersMap: Record<string, unknown> = {};
          league.rosters.forEach((roster) => {
            usersMap[roster.user_id] = buildUserAttachment(
              roster,
              league.league_id,
            );
          });

          try {
            const dmResult = await getDm({ members: [user_id] });
            const dmId = dmResult.get_dm_by_members.dm_id;

            await sendMessage({
              parent_id: dmId,
              text: `@${userRoster.username} has proposed a trade in ${league.name}`,
              k_attachment_data: [
                "status",
                "transactions_by_roster",
                "transaction_id",
                "league_id",
                "users_in_league_map",
              ],
              v_attachment_data: [
                "proposed",
                JSON.stringify(transactionsByRoster),
                transaction.transaction_id,
                vars.league_id,
                JSON.stringify(usersMap),
              ],
            });
          } catch (e) {
            console.error(`DM for proposal ${i + 1} failed:`, e);
          }
        }
      } catch (e) {
        console.error(`Trade proposal ${i + 1} failed:`, e);
      }
      setSubmitProgress(i + 1);
      if (i < selectedProposals.length - 1) {
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
      }
    }
    setSubmitting(false);
    setSelectedProposals([]);
  }, [
    selectedProposals,
    proposeTrade,
    getDm,
    sendMessage,
    leagues,
    allplayers,
    playersToGive,
    playersToReceive,
    picksToGive,
    picksToReceive,
  ]);

  const ownedPlayers = useMemo(
    () =>
      Object.keys(playerShares).filter(
        (player_id) => playerShares[player_id].owned.length > 0,
      ),
    [playerShares],
  );

  const takenPlayers = useMemo(
    () =>
      Object.keys(playerShares).filter(
        (player_id) => playerShares[player_id].taken.length > 0,
      ),
    [playerShares, pickShares],
  );

  const ownedPicks = useMemo(
    () =>
      Object.keys(pickShares).filter(
        (pick_id) => pickShares[pick_id].owned.length > 0,
      ),
    [pickShares],
  );

  const takenPicks = useMemo(
    () =>
      Object.keys(pickShares).filter(
        (pick_id) => pickShares[pick_id].taken.length > 0,
      ),
    [pickShares],
  );

  const filterLeagues = (
    leagues: LeagueDetailed[],
    playersToGive: string[],
    playersToReceive: string[],
    picksToGive: string[],
    picksToReceive: string[],
  ) => {
    return leagues.filter((league) => {
      const hasPlayersToGive = playersToGive.every((player_id) =>
        league.user_roster.players.includes(player_id),
      );
      const hasPicksToGive = picksToGive.every((pick_id) =>
        league.user_roster.draftpicks.some((p) => getPickId(p) === pick_id),
      );

      const hasPlayerToReceive = league.rosters
        .filter((roster) => roster.roster_id !== league.user_roster.roster_id)
        .some((roster) =>
          playersToReceive.every((player_id) =>
            roster.players.includes(player_id),
          ),
        );

      const hasPicksToReceive = league.rosters
        .filter((roster) => roster.roster_id !== league.user_roster.roster_id)
        .some((roster) =>
          picksToReceive.every((pick_id) =>
            roster.draftpicks.some((p) => getPickId(p) === pick_id),
          ),
        );

      return (
        hasPlayersToGive &&
        hasPicksToGive &&
        hasPlayerToReceive &&
        hasPicksToReceive
      );
    });
  };

  const filteredLeagues = useMemo(
    () =>
      filterLeagues(
        Object.values(leagues),
        playersToGive,
        playersToReceive,
        picksToGive,
        picksToReceive,
      ).map((league) => {
        const tradingWith = league.rosters.filter(
          (roster) =>
            roster.roster_id !== league.user_roster.roster_id &&
            playersToReceive.every((p) => roster.players.includes(p)) &&
            picksToReceive.every((p) =>
              roster.draftpicks.some((d) => getPickId(d) === p),
            ),
        );
        return { ...league, tradingWith };
      }),
    [leagues, playersToGive, playersToReceive, picksToGive, picksToReceive],
  );

  const tradeCount = useMemo(
    () => filteredLeagues.reduce((sum, l) => sum + l.tradingWith.length, 0),
    [filteredLeagues],
  );

  const [tab, setTab] = useState<TradesTab>("create");
  const {
    trades: pendingTrades,
    loading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = usePendingTrades(leagues);

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {/* Tabs */}
      <div className="flex gap-2 w-full max-w-3xl">
        <button
          onClick={() => setTab("create")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            tab === "create"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200"
          }`}
        >
          Create Trade
        </button>
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            tab === "pending"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-gray-200"
          }`}
        >
          Pending
          {pendingTrades.length > 0 && (
            <span className="ml-1.5 rounded-full bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 text-xs">
              {pendingTrades.length}
            </span>
          )}
        </button>
      </div>

      {tab === "pending" ? (
        <PendingTradesPanel
          trades={pendingTrades}
          loading={pendingLoading}
          error={pendingError}
          refetch={refetchPending}
          leagues={leagues}
          allplayers={allplayers}
        />
      ) : (
      <>
      {/* Trade builder */}
      <div className="flex gap-4 w-full max-w-3xl">
        {/* Give side */}
        <div className="flex-1 flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400">
            You give
          </h3>
          <PlayerCombobox
            id="players-to-give"
            playerIds={ownedPlayers}
            allplayers={allplayers}
            selected={[...playersToGive, ...playersToReceive]}
            onSelect={(player_id) =>
              setPlayerstoGive((prev) =>
                prev.includes(player_id) ? prev : [...prev, player_id],
              )
            }
            placeholder="Search players..."
          />
          <PlayerCombobox
            id="picks-to-give"
            playerIds={ownedPicks}
            allplayers={allplayers}
            selected={[...picksToGive, ...picksToReceive]}
            onSelect={(pick_id) =>
              setPicksToGive((prev) =>
                prev.includes(pick_id) ? prev : [...prev, pick_id],
              )
            }
            placeholder="Search picks..."
          />
          {(playersToGive.length > 0 || picksToGive.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {playersToGive.map((player_id) => (
                <span
                  key={player_id}
                  className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-0.5 text-xs text-red-300"
                >
                  {allplayers[player_id]?.full_name || player_id}
                  <button
                    onClick={() =>
                      setPlayerstoGive((prev) =>
                        prev.filter((p) => p !== player_id),
                      )
                    }
                    className="text-red-400 hover:text-red-300 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {picksToGive.map((pick_id) => (
                <span
                  key={pick_id}
                  className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-0.5 text-xs text-red-300"
                >
                  {pick_id}
                  <button
                    onClick={() =>
                      setPicksToGive((prev) =>
                        prev.filter((p) => p !== pick_id),
                      )
                    }
                    className="text-red-400 hover:text-red-300 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Receive side */}
        <div className="flex-1 flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-green-400">
            You receive
          </h3>
          <PlayerCombobox
            id="players-to-receive"
            playerIds={takenPlayers}
            allplayers={allplayers}
            selected={[...playersToReceive, ...playersToGive]}
            onSelect={(player_id) =>
              setPlayersToReceive((prev) =>
                prev.includes(player_id) ? prev : [...prev, player_id],
              )
            }
            placeholder="Search players..."
          />
          <PlayerCombobox
            id="picks-to-receive"
            playerIds={takenPicks}
            allplayers={allplayers}
            selected={[...picksToReceive, ...picksToGive]}
            onSelect={(pick_id) =>
              setPicksToReceive((prev) =>
                prev.includes(pick_id) ? prev : [...prev, pick_id],
              )
            }
            placeholder="Search picks..."
          />
          {(playersToReceive.length > 0 || picksToReceive.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {playersToReceive.map((player_id) => (
                <span
                  key={player_id}
                  className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-0.5 text-xs text-green-300"
                >
                  {allplayers[player_id]?.full_name || player_id}
                  <button
                    onClick={() =>
                      setPlayersToReceive((prev) =>
                        prev.filter((p) => p !== player_id),
                      )
                    }
                    className="text-green-400 hover:text-green-300 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {picksToReceive.map((pick_id) => (
                <span
                  key={pick_id}
                  className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-0.5 text-xs text-green-300"
                >
                  {pick_id}
                  <button
                    onClick={() =>
                      setPicksToReceive((prev) =>
                        prev.filter((p) => p !== pick_id),
                      )
                    }
                    className="text-green-400 hover:text-green-300 ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Potential trades */}
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-100">
              Potential Trades
            </h2>
            {filteredLeagues.length > 0 && (
              <span className="text-sm text-gray-500">
                {tradeCount} {tradeCount === 1 ? "trade" : "trades"} in{" "}
                {filteredLeagues.length}{" "}
                {filteredLeagues.length === 1 ? "league" : "leagues"}
                {selectedProposals.length > 0 &&
                  ` · ${selectedProposals.length} selected`}
              </span>
            )}
          </div>
          {selectedProposals.length > 0 && (
            <button
              onClick={submitProposals}
              disabled={submitting}
              className="rounded-lg bg-yellow-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-yellow-500 disabled:opacity-50"
            >
              {submitting
                ? `Sending ${submitProgress}/${selectedProposals.length}...`
                : `Send ${selectedProposals.length} ${selectedProposals.length === 1 ? "proposal" : "proposals"}`}
            </button>
          )}
        </div>

        {playersToGive.length === 0 &&
        playersToReceive.length === 0 &&
        picksToGive.length === 0 &&
        picksToReceive.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Select players or picks above to see potential trades.
          </p>
        ) : (
          <PotentialTrades
            playersToGive={playersToGive}
            playersToReceive={playersToReceive}
            picksToGive={picksToGive}
            picksToReceive={picksToReceive}
            filteredLeagues={filteredLeagues}
            selectedProposals={selectedProposals}
            setSelectedProposals={setSelectedProposals}
          />
        )}
      </div>
      </>
      )}
    </div>
  );
}

function PendingTradesPanel({
  trades,
  loading,
  error,
  refetch,
  leagues,
  allplayers,
}: {
  trades: PendingTrade[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  leagues: { [league_id: string]: LeagueDetailed };
  allplayers: { [player_id: string]: Allplayer };
}) {
  const resolveRoster = (league_id: string, roster_id: number) => {
    const league = leagues[league_id];
    return league?.rosters.find((r) => r.roster_id === roster_id);
  };

  const formatTime = (epoch: number) => {
    const d = new Date(epoch * 1000);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading pending trades...</p>;
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-400 mb-2">{error}</p>
        <button
          onClick={refetch}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-500 text-sm">No pending trades across your leagues.</p>
        <button
          onClick={refetch}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">
          Pending Trades
          <span className="ml-2 text-sm font-normal text-gray-500">
            {trades.length} {trades.length === 1 ? "trade" : "trades"}
          </span>
        </h2>
        <button
          onClick={refetch}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {trades.map((trade) => {
          const rosterIds = trade.roster_ids;
          const sides = rosterIds.map((rid) => {
            const roster = resolveRoster(trade.league_id, rid);
            const adding = Object.entries(trade.adds ?? {})
              .filter(([, rId]) => rId === rid)
              .map(([pid]) => pid);
            const dropping = Object.entries(trade.drops ?? {})
              .filter(([, rId]) => rId === rid)
              .map(([pid]) => pid);
            return { roster, roster_id: rid, adding, dropping };
          });

          return (
            <div
              key={trade.transaction_id}
              className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/80 border-b border-gray-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-100">
                    {trade.league_name}
                  </span>
                  <span className="rounded bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 text-xs">
                    Proposed
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatTime(trade.created)}
                </span>
              </div>

              {/* Trade sides */}
              <div className="flex divide-x divide-gray-700">
                {sides.map((side) => (
                  <div
                    key={side.roster_id}
                    className="flex-1 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        hash={side.roster?.avatar}
                        alt={side.roster?.username ?? `Roster ${side.roster_id}`}
                        size={24}
                      />
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {side.roster?.username ?? `Roster ${side.roster_id}`}
                      </span>
                    </div>

                    {side.adding.length > 0 && (
                      <div className="mb-1.5">
                        <span className="text-xs text-green-500 font-medium">Receives</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {side.adding.map((pid) => (
                            <span
                              key={pid}
                              className="rounded-full bg-green-900/30 border border-green-800/50 px-2 py-0.5 text-xs text-green-300"
                            >
                              {allplayers[pid]?.full_name ?? pid}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {side.dropping.length > 0 && (
                      <div>
                        <span className="text-xs text-red-500 font-medium">Gives up</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {side.dropping.map((pid) => (
                            <span
                              key={pid}
                              className="rounded-full bg-red-900/30 border border-red-800/50 px-2 py-0.5 text-xs text-red-300"
                            >
                              {allplayers[pid]?.full_name ?? pid}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {side.adding.length === 0 && side.dropping.length === 0 && (
                      <span className="text-xs text-gray-500">Draft picks only</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerCombobox({
  id,
  playerIds,
  allplayers,
  selected,
  onSelect,
  placeholder = "Search...",
}: {
  id: string;
  playerIds: string[];
  allplayers: { [player_id: string]: Allplayer };
  selected: string[];
  onSelect: (player_id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...playerIds].sort((a, b) => {
      const an = allplayers[a]?.full_name || a;
      const bn = allplayers[b]?.full_name || b;
      return an.localeCompare(bn);
    });
    if (!q) return sorted;
    return sorted.filter((player_id) => {
      const p = allplayers[player_id];
      const name = (p?.full_name || player_id).toLowerCase();
      return name.includes(q);
    });
  }, [query, playerIds, allplayers]);

  // Reset highlight when the filtered list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, playerIds]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const choose = (player_id: string) => {
    onSelect(player_id);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[activeIndex];
      if (pick) choose(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-gray-100"
      />
      {open && matches.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded border border-gray-700 bg-gray-900 shadow-lg"
        >
          {matches.map((player_id, i) => {
            const p = allplayers[player_id];
            const isActive = i === activeIndex;
            const isSelected = selected.includes(player_id);
            return (
              <li
                key={player_id}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  // mousedown so the input's blur doesn't close us first
                  e.preventDefault();
                  choose(player_id);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer items-center justify-between px-2.5 py-1.5 text-sm ${
                  isActive ? "bg-blue-600 text-white" : "text-gray-100"
                } ${isSelected ? "opacity-50" : ""}`}
              >
                <span>{p?.full_name || player_id}</span>
                {p && (
                  <span className="ml-2 text-xs text-gray-400">
                    {p.position} · {p.team ?? "FA"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs";

function Avatar({
  hash,
  alt,
  size = 40,
}: {
  hash: string | null | undefined;
  alt: string;
  size?: number;
}) {
  const initial = (alt?.[0] || "?").toUpperCase();
  return hash ? (
    <img
      src={`${AVATAR_BASE}/${hash}`}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full bg-gray-700 object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-300"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}

function formatRecord(r: { wins: number; losses: number; ties: number }) {
  return r.ties > 0
    ? `${r.wins}-${r.losses}-${r.ties}`
    : `${r.wins}-${r.losses}`;
}

function PotentialTrades({
  playersToGive,
  playersToReceive,
  picksToGive,
  picksToReceive,
  filteredLeagues,
  selectedProposals,
  setSelectedProposals,
}: {
  playersToGive: string[];
  playersToReceive: string[];
  picksToGive: string[];
  picksToReceive: string[];
  filteredLeagues: (LeagueDetailed & { tradingWith: Roster[] })[];
  selectedProposals: (ProposeTradeVars & { user_id: string })[];
  setSelectedProposals: React.Dispatch<
    React.SetStateAction<(ProposeTradeVars & { user_id: string })[]>
  >;
}) {
  const cards = filteredLeagues.flatMap((league) =>
    league.tradingWith.map((partner) => ({ league, partner })),
  );

  if (cards.length === 0) {
    return (
      <p className="text-gray-400">
        No leagues match the selected players and picks.
      </p>
    );
  }

  return (
    <div className="grid w-full gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ league, partner }) => {
        const typeLabel =
          league.settings.type === 2
            ? "Dynasty"
            : league.settings.type === 1
              ? "Keeper"
              : "Redraft";

        return (
          <div
            key={`${league.league_id}-${partner.roster_id}`}
            className={`flex flex-col gap-2.5 rounded-lg border p-3.5 cursor-pointer transition ${
              selectedProposals.some(
                (p) =>
                  p.league_id === league.league_id &&
                  p.user_id === partner.user_id,
              )
                ? "border-yellow-500 bg-yellow-500/5 shadow-md shadow-yellow-500/10"
                : "border-gray-700 bg-gray-800 hover:border-gray-600"
            }`}
            onClick={() =>
              setSelectedProposals((prev) => {
                const exists = prev.some(
                  (p) =>
                    p.league_id === league.league_id &&
                    p.user_id === partner.user_id,
                );
                if (exists) {
                  return prev.filter(
                    (p) =>
                      !(
                        p.league_id === league.league_id &&
                        p.user_id === partner.user_id
                      ),
                  );
                } else {
                  return [
                    ...prev,
                    {
                      league_id: league.league_id,
                      user_id: partner.user_id,
                      k_adds: [...playersToGive, ...playersToReceive],
                      v_adds: [
                        ...playersToGive.map(() => partner.roster_id),
                        ...playersToReceive.map(
                          () => league.user_roster.roster_id,
                        ),
                      ],
                      k_drops: [...playersToGive, ...playersToReceive],
                      v_drops: [
                        ...playersToGive.map(
                          () => league.user_roster.roster_id,
                        ),
                        ...playersToReceive.map(() => partner.roster_id),
                      ],
                      draft_picks: [
                        ...picksToGive.flatMap((pickId) => {
                          const pick = league.user_roster.draftpicks.find(
                            (d) => getPickId(d) === pickId,
                          );
                          if (!pick) return [];
                          return [
                            `${pick.roster_id},${pick.season},${pick.round},${league.user_roster.roster_id},${partner.roster_id}`,
                          ];
                        }),
                        ...picksToReceive.flatMap((pickId) => {
                          const pick = partner.draftpicks.find(
                            (d) => getPickId(d) === pickId,
                          );
                          if (!pick) return [];
                          return [
                            `${pick.roster_id},${pick.season},${pick.round},${partner.roster_id},${league.user_roster.roster_id}`,
                          ];
                        }),
                      ],
                      waiver_budget: [],
                    },
                  ];
                }
              })
            }
          >
            {/* League header */}
            <div className="flex items-center gap-2.5 border-b border-gray-700/50 pb-2.5">
              <Avatar hash={league.avatar} alt={league.name} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-gray-100">
                  {league.name}
                </span>
                <span className="text-xs text-gray-500">
                  {league.season} · {typeLabel} · {league.rosters.length} teams
                </span>
              </div>
              <span className="rounded bg-gray-700/60 px-1.5 py-0.5 text-xs text-gray-300">
                {formatRecord(league.user_roster)}
              </span>
            </div>

            {/* Trading partner */}
            <div className="flex items-center gap-2 rounded bg-gray-900/40 px-2 py-1.5">
              <Avatar
                hash={partner.avatar}
                alt={partner.username}
                size={24}
              />
              <span className="flex-1 truncate text-sm text-gray-100">
                {partner.username}
              </span>
              <span className="text-xs text-gray-500">
                {formatRecord(partner)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
