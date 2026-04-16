import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  Leaguemates,
  PickShares,
  PlayerShares,
  ProposeTradeVars,
} from "@sleepier/shared";
import { getPickId, buildPlayerAttachment, buildUserAttachment } from "@sleepier/shared";
import { useTradesByStatus } from "../../../hooks/use-trades-by-status";
import { useIpcMutation } from "../../../hooks/use-ipc-mutation";
import { useTradeValueFilter } from "../../../hooks/use-trade-value-filter";
import type { InterestByLeague } from "../../../hooks/use-league-players";
import { TradesPanel } from "./trades-panel";
import { PotentialTrades } from "./potential-trades";
import { PlayerCombobox } from "../../components/player-combobox";
import { TradeFilterBar } from "../../components/trade-filter-bar";

type TradesTab = "create" | "pending" | "completed" | "rejected";

// Convert a UI pick_id like "2026 1.03" or "2026 Round 2" into the KTC-compatible name
// like "2026 Early 1st" / "2026 Mid 2nd" / etc.
function pickIdToKtcName(pickId: string): string {
  const [season, rest] = pickId.split(" ", 2);
  if (!season || !rest) return pickId;
  // Handle "Round X" format (no order known)
  if (rest === "Round") {
    const round = parseInt(pickId.split(" ")[2], 10);
    return `${season} Mid ${round}${suffix(round)}`;
  }
  // Handle "X.YY" format
  const [roundStr, orderStr] = rest.split(".");
  const round = parseInt(roundStr, 10);
  const order = orderStr ? parseInt(orderStr, 10) : 0;
  const type = !order ? "Mid" : order <= 4 ? "Early" : order >= 9 ? "Late" : "Mid";
  return `${season} ${type} ${round}${suffix(round)}`;
}

function suffix(round: number): string {
  return round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th";
}

export default function TradesView({
  leagues,
  playerShares,
  leaguemates,
  pickShares,
  allplayers,
  userId,
  ktc,
  interestByLeague,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  playerShares: PlayerShares;
  leaguemates: Leaguemates;
  pickShares: PickShares;
  allplayers: { [player_id: string]: Allplayer };
  userId: string;
  ktc: Record<string, number>;
  interestByLeague?: InterestByLeague;
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
  const { mutate: acceptTradeMut } = useIpcMutation("acceptTrade");
  const { mutate: rejectTradeMut } = useIpcMutation("rejectTrade");
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
  const valueFilter = useTradeValueFilter({ leagues, allplayers, ktc });
  const {
    trades: pendingTrades,
    loading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useTradesByStatus(leagues, "proposed");
  const {
    trades: completedTrades,
    loading: completedLoading,
    error: completedError,
    refetch: refetchCompleted,
  } = useTradesByStatus(leagues, "complete");
  const {
    trades: rejectedTrades,
    loading: rejectedLoading,
    error: rejectedError,
    refetch: refetchRejected,
  } = useTradesByStatus(leagues, "rejected");

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {/* Tabs */}
      <div className="flex w-full max-w-3xl border-b border-gray-700">
        {(["create", "pending", "completed", "rejected"] as TradesTab[]).map((t) => {
          const count = t === "pending" ? pendingTrades.length
            : t === "completed" ? completedTrades.length
            : t === "rejected" ? rejectedTrades.length
            : 0;
          const label = t === "create" ? "Create Trade"
            : t === "pending" ? "Pending"
            : t === "completed" ? "Completed"
            : "Rejected";
          const badgeColor = t === "pending" ? "bg-yellow-500/20 text-yellow-400"
            : t === "completed" ? "bg-green-500/20 text-green-400"
            : "bg-red-500/20 text-red-400";
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-5 py-2.5 text-sm font-medium transition ${
                tab === t
                  ? "text-gray-100"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
              {t !== "create" && count > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold ${badgeColor}`}>
                  {count}
                </span>
              )}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t" />
              )}
            </button>
          );
        })}
      </div>

      {/* Value / position / threshold filter bar — shared across all tabs */}
      <TradeFilterBar filter={valueFilter} />

      {tab === "pending" ? (
        <TradesPanel
          trades={pendingTrades}
          loading={pendingLoading}
          error={pendingError}
          refetch={refetchPending}
          leagues={leagues}
          allplayers={allplayers}
          userId={userId}
          ktc={ktc}
          filter={valueFilter}
          statusLabel="Pending"
          emptyMessage="No pending trades across your leagues."
          onAccept={async (trade) => {
            await acceptTradeMut({
              league_id: trade.league_id,
              transaction_id: trade.transaction_id,
              leg: trade.leg,
            });
            refetchPending();
          }}
          onReject={async (trade) => {
            await rejectTradeMut({
              league_id: trade.league_id,
              transaction_id: trade.transaction_id,
              leg: trade.leg,
            });
            refetchPending();
          }}
          onCounter={async ({ trade, playerIdsToGive, playerIdsToReceive, pickIdsToGive, pickIdsToReceive }) => {
            const league = leagues[trade.league_id];
            const userRosterId = league.user_roster.roster_id;
            const partnerRosterId = trade.roster_ids.find((rid) => rid !== userRosterId)!;
            const partnerRoster = league.rosters.find((r) => r.roster_id === partnerRosterId)!;
            await proposeTrade({
              league_id: trade.league_id,
              k_adds: [...playerIdsToGive, ...playerIdsToReceive],
              v_adds: [
                ...playerIdsToGive.map(() => partnerRosterId),
                ...playerIdsToReceive.map(() => userRosterId),
              ],
              k_drops: [...playerIdsToGive, ...playerIdsToReceive],
              v_drops: [
                ...playerIdsToGive.map(() => userRosterId),
                ...playerIdsToReceive.map(() => partnerRosterId),
              ],
              draft_picks: [
                ...pickIdsToGive.flatMap((pickId) => {
                  const pick = league.user_roster.draftpicks.find((d) => getPickId(d) === pickId);
                  if (!pick) return [];
                  return [`${pick.roster_id},${pick.season},${pick.round},${partnerRosterId},${userRosterId}`];
                }),
                ...pickIdsToReceive.flatMap((pickId) => {
                  const pick = partnerRoster.draftpicks.find((d) => getPickId(d) === pickId);
                  if (!pick) return [];
                  return [`${pick.roster_id},${pick.season},${pick.round},${userRosterId},${partnerRosterId}`];
                }),
              ],
              waiver_budget: [],
              reject_transaction_id: trade.transaction_id,
              reject_transaction_leg: trade.leg,
            });
            refetchPending();
          }}
          onWithdraw={async (trade) => {
            await rejectTradeMut({
              league_id: trade.league_id,
              transaction_id: trade.transaction_id,
              leg: trade.leg,
            });
            refetchPending();
          }}
          onModify={async ({ trade, playerIdsToGive, playerIdsToReceive, pickIdsToGive, pickIdsToReceive }) => {
            const league = leagues[trade.league_id];
            const userRosterId = league.user_roster.roster_id;
            const partnerRosterId = trade.roster_ids.find((rid) => rid !== userRosterId)!;
            const partnerRoster = league.rosters.find((r) => r.roster_id === partnerRosterId)!;
            await proposeTrade({
              league_id: trade.league_id,
              k_adds: [...playerIdsToGive, ...playerIdsToReceive],
              v_adds: [
                ...playerIdsToGive.map(() => partnerRosterId),
                ...playerIdsToReceive.map(() => userRosterId),
              ],
              k_drops: [...playerIdsToGive, ...playerIdsToReceive],
              v_drops: [
                ...playerIdsToGive.map(() => userRosterId),
                ...playerIdsToReceive.map(() => partnerRosterId),
              ],
              draft_picks: [
                ...pickIdsToGive.flatMap((pickId) => {
                  const pick = league.user_roster.draftpicks.find((d) => getPickId(d) === pickId);
                  if (!pick) return [];
                  return [`${pick.roster_id},${pick.season},${pick.round},${partnerRosterId},${userRosterId}`];
                }),
                ...pickIdsToReceive.flatMap((pickId) => {
                  const pick = partnerRoster.draftpicks.find((d) => getPickId(d) === pickId);
                  if (!pick) return [];
                  return [`${pick.roster_id},${pick.season},${pick.round},${userRosterId},${partnerRosterId}`];
                }),
              ],
              waiver_budget: [],
              reject_transaction_id: trade.transaction_id,
              reject_transaction_leg: trade.leg,
            });
            refetchPending();
          }}
        />
      ) : tab === "completed" ? (
        <TradesPanel
          trades={completedTrades}
          loading={completedLoading}
          error={completedError}
          refetch={refetchCompleted}
          leagues={leagues}
          allplayers={allplayers}
          userId={userId}
          ktc={ktc}
          filter={valueFilter}
          statusLabel="Completed"
          emptyMessage="No completed trades across your leagues."
        />
      ) : tab === "rejected" ? (
        <TradesPanel
          trades={rejectedTrades}
          loading={rejectedLoading}
          error={rejectedError}
          refetch={refetchRejected}
          leagues={leagues}
          allplayers={allplayers}
          userId={userId}
          ktc={ktc}
          filter={valueFilter}
          statusLabel="Rejected"
          emptyMessage="No rejected trades across your leagues."
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
              {playersToGive.map((player_id) => {
                const value = ktc[player_id] ?? 0;
                return (
                  <span
                    key={player_id}
                    className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-0.5 text-xs text-red-300"
                  >
                    {allplayers[player_id]?.full_name || player_id}
                    {value > 0 && <span className="text-red-400/70 text-[10px]">{value}</span>}
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
                );
              })}
              {picksToGive.map((pick_id) => {
                const value = ktc[pickIdToKtcName(pick_id)] ?? 0;
                return (
                  <span
                    key={pick_id}
                    className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-0.5 text-xs text-red-300"
                  >
                    {pick_id}
                    {value > 0 && <span className="text-red-400/70 text-[10px]">{value}</span>}
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
                );
              })}
            </div>
          )}
          {(playersToGive.length > 0 || picksToGive.length > 0) && (
            <div className="flex justify-between items-center border-t border-gray-700/50 pt-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total KTC</span>
              <span className="text-sm font-semibold text-red-400">
                {(
                  playersToGive.reduce((sum, pid) => sum + (ktc[pid] ?? 0), 0) +
                  picksToGive.reduce((sum, pid) => sum + (ktc[pickIdToKtcName(pid)] ?? 0), 0)
                ).toLocaleString()}
              </span>
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
              {playersToReceive.map((player_id) => {
                const value = ktc[player_id] ?? 0;
                return (
                  <span
                    key={player_id}
                    className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-0.5 text-xs text-green-300"
                  >
                    {allplayers[player_id]?.full_name || player_id}
                    {value > 0 && <span className="text-green-400/70 text-[10px]">{value}</span>}
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
                );
              })}
              {picksToReceive.map((pick_id) => {
                const value = ktc[pickIdToKtcName(pick_id)] ?? 0;
                return (
                  <span
                    key={pick_id}
                    className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-0.5 text-xs text-green-300"
                  >
                    {pick_id}
                    {value > 0 && <span className="text-green-400/70 text-[10px]">{value}</span>}
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
                );
              })}
            </div>
          )}
          {(playersToReceive.length > 0 || picksToReceive.length > 0) && (
            <div className="flex justify-between items-center border-t border-gray-700/50 pt-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total KTC</span>
              <span className="text-sm font-semibold text-green-400">
                {(
                  playersToReceive.reduce((sum, pid) => sum + (ktc[pid] ?? 0), 0) +
                  picksToReceive.reduce((sum, pid) => sum + (ktc[pickIdToKtcName(pid)] ?? 0), 0)
                ).toLocaleString()}
              </span>
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
            allplayers={allplayers}
            userId={userId}
            leagues={leagues}
            filter={valueFilter}
            interestByLeague={interestByLeague}
          />
        )}
      </div>
      </>
      )}
    </div>
  );
}
