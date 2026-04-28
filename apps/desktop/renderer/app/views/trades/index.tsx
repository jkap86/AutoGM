import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Allplayer,
  LeagueDetailed,
  Leaguemates,
  PickShares,
  PlayerShares,
  ProposeTradeVars,
} from "@autogm/shared";
import { getPickId, buildPlayerAttachment, buildUserAttachment } from "@autogm/shared";
import { useTradesByStatus } from "../../../hooks/use-trades-by-status";
import { useIpcMutation, useGraphqlMutation } from "../../../hooks/use-ipc-mutation";
import { useTradeValueFilter } from "../../../hooks/use-trade-value-filter";
import type { InterestByLeague } from "../../../hooks/use-league-players";
import { TradesPanel } from "./trades-panel";
import { PotentialTrades } from "./potential-trades";
import { PlayerCombobox } from "../../components/player-combobox";
import { TradeFilterBar } from "../../components/trade-filter-bar";
type TransactionType = "trades" | "waivers";
type TradesTab = "create" | "pending" | "expired" | "completed" | "rejected";

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

// Get the specific pick key for precise valuation (e.g., "2026 1.08")
function pickIdToSpecificKey(pickId: string): string | null {
  const [season, rest] = pickId.split(" ", 2);
  if (!season || !rest) return null;
  if (rest === "Round") return null;
  const [roundStr, orderStr] = rest.split(".");
  const round = parseInt(roundStr, 10);
  const order = orderStr ? parseInt(orderStr, 10) : 0;
  if (!order) return null;
  return `${season} ${round}.${String(order).padStart(2, '0')}`;
}

function suffix(round: number): string {
  return round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th";
}

// Look up pick value: try specific key first, fall back to grouped KTC name
function getPickValue(pickId: string, ktc: Record<string, number>): number {
  const specific = pickIdToSpecificKey(pickId);
  if (specific && ktc[specific] != null) return ktc[specific];
  return ktc[pickIdToKtcName(pickId)] ?? 0;
}

export default function TransactionsView(props: {
  leagues: { [league_id: string]: LeagueDetailed };
  playerShares: PlayerShares;
  leaguemates: Leaguemates;
  pickShares: PickShares;
  allplayers: { [player_id: string]: Allplayer };
  userId: string;
  ktc: Record<string, number>;
  interestByLeague?: InterestByLeague;
  tradeBlockByLeague?: InterestByLeague;
}) {
  const [txType, setTxType] = useState<TransactionType>("trades");

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-4">
      {/* Transaction type tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900/60 p-0.5">
        {([
          { key: "trades" as TransactionType, label: "Trades" },
          { key: "waivers" as TransactionType, label: "Waivers" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTxType(key)}
            className={`rounded-md px-5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              txType === key
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {txType === "trades" && <TradesContent {...props} />}
      {txType === "waivers" && (
        <div className="flex flex-col items-center py-12 gap-3">
          <p className="text-gray-500 text-sm">Waivers coming soon.</p>
        </div>
      )}
    </div>
  );
}

function TradesContent({
  leagues,
  playerShares,
  leaguemates,
  pickShares,
  allplayers,
  userId,
  ktc,
  interestByLeague,
  tradeBlockByLeague,
}: {
  leagues: { [league_id: string]: LeagueDetailed };
  playerShares: PlayerShares;
  leaguemates: Leaguemates;
  pickShares: PickShares;
  allplayers: { [player_id: string]: Allplayer };
  userId: string;
  ktc: Record<string, number>;
  interestByLeague?: InterestByLeague;
  tradeBlockByLeague?: InterestByLeague;
}) {
  const [playersToGive, setPlayerstoGive] = useState<string[]>([]);
  const [playersToReceive, setPlayersToReceive] = useState<string[]>([]);
  const [picksToGive, setPicksToGive] = useState<string[]>([]);
  const [picksToReceive, setPicksToReceive] = useState<string[]>([]);
  // Roster filters: narrow results by player ownership (not part of the trade itself)
  const [userOwnsFilter, setUserOwnsFilter] = useState<string[]>([]);
  const [userLacksFilter, setUserLacksFilter] = useState<string[]>([]);
  const [partnerOwnsFilter, setPartnerOwnsFilter] = useState<string[]>([]);
  const [partnerLacksFilter, setPartnerLacksFilter] = useState<string[]>([]);

  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const [selectedProposals, setSelectedProposals] = useState<
    (ProposeTradeVars & { user_id: string; _effective?: { playersToGive: string[]; playersToReceive: string[]; picksToGive: string[]; picksToReceive: string[] } })[]
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  useEffect(() => {
    setSelectedProposals([]);
  }, [playersToGive, playersToReceive, picksToGive, picksToReceive]);

  const { mutate: proposeTrade } = useIpcMutation<"proposeTrade">("trade:propose");
  const { mutate: acceptTradeMut } = useIpcMutation<"acceptTrade">("trade:accept");
  const { mutate: rejectTradeMut } = useIpcMutation<"rejectTrade">("trade:reject");
  const { mutate: getDm } = useGraphqlMutation("getDmByMembers");
  const { mutate: createDm } = useIpcMutation<"createDm">("dm:create");
  const { mutate: sendMessage } = useIpcMutation<"createMessage">("message:create");

  // Helper: get-or-create a DM channel, then send a trade attachment message.
  const sendTradeDm = useCallback(async (
    leagueId: string,
    partnerId: string,
    transaction: { transaction_id: string },
    playerIdsGiving: string[],
    playerIdsReceiving: string[],
    pickIdsGiving: string[],
    pickIdsReceiving: string[],
    status: string,
    text: string,
  ) => {
    const league = leagues[leagueId];
    const partnerRoster = league?.rosters.find((r) => r.user_id === partnerId);
    if (!league || !partnerRoster) return;
    const userRoster = league.user_roster;

    // In Sleeper's DM attachment, "adds" = what this roster RECEIVES.
    // User gives → partner receives (partner's adds). Partner gives → user receives (user's adds).
    const transactionsByRoster: Record<string, unknown> = {
      [userRoster.roster_id]: {
        adds: playerIdsReceiving.map((pid) => buildPlayerAttachment(allplayers[pid])),
        drops: [],
        added_picks: pickIdsReceiving.flatMap((pickId) => {
          const pick = partnerRoster.draftpicks.find((d) => getPickId(d) === pickId);
          if (!pick) return [];
          return [{
            roster_id: String(pick.roster_id),
            season: pick.season,
            round: String(pick.round),
            owner_id: userRoster.user_id,
            previous_owner_id: partnerRoster.user_id,
            original_owner_id: pick.original_user?.user_id ?? "",
          }];
        }),
        dropped_picks: [],
        added_budget: [],
        dropped_budget: [],
        status,
        user: buildUserAttachment(userRoster, leagueId),
      },
      [partnerRoster.roster_id]: {
        adds: playerIdsGiving.map((pid) => buildPlayerAttachment(allplayers[pid])),
        drops: [],
        added_picks: pickIdsGiving.flatMap((pickId) => {
          const pick = userRoster.draftpicks.find((d) => getPickId(d) === pickId);
          if (!pick) return [];
          return [{
            roster_id: String(pick.roster_id),
            season: pick.season,
            round: String(pick.round),
            owner_id: partnerRoster.user_id,
            previous_owner_id: userRoster.user_id,
            original_owner_id: pick.original_user?.user_id ?? "",
          }];
        }),
        dropped_picks: [],
        added_budget: [],
        dropped_budget: [],
        status,
        user: buildUserAttachment(partnerRoster, leagueId),
      },
    };

    const dmResult = await getDm({ members: [userId, partnerId] });
    let dmId = dmResult.get_dm_by_members?.dm_id;
    if (!dmId) {
      const newDm = await createDm({ members: [userId, partnerId], dm_type: "direct" });
      dmId = newDm.create_dm.dm_id;
    }

    await sendMessage({
      parent_id: dmId,
      text,
      attachment_type: "trade_dm",
      k_attachment_data: [
        "status",
        "transactions_by_roster",
        "transaction_id",
        "league_id",
      ],
      v_attachment_data: [
        status,
        JSON.stringify(transactionsByRoster),
        transaction.transaction_id,
        leagueId,
      ],
    });
  }, [leagues, allplayers, userId, getDm, createDm, sendMessage]);

  const handleCounterOrModify = useCallback(async (
    { trade, playerIdsToGive, playerIdsToReceive, pickIdsToGive, pickIdsToReceive, expiresAt: counterExpires }: import("./trades-panel").CounterOffer,
    action: string,
  ) => {
    const league = leagues[trade.league_id];
    const userRosterId = league.user_roster.roster_id;
    const partnerRosterId = trade.roster_ids.find((rid) => rid !== userRosterId)!;
    const partnerRoster = league.rosters.find((r) => r.roster_id === partnerRosterId)!;
    const result = await proposeTrade({
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
      ...(counterExpires ? { expires_at: Math.floor(counterExpires / 1000) } : {}),
    });
    try {
      await sendTradeDm(
        trade.league_id,
        partnerRoster.user_id,
        result.propose_trade,
        playerIdsToGive,
        playerIdsToReceive,
        pickIdsToGive,
        pickIdsToReceive,
        "proposed",
        `@${league.user_roster.username} has ${action} a trade in ${league.name}`,
      );
    } catch (e) {
      console.error(`DM for ${action} trade failed:`, e);
    }
  }, [leagues, proposeTrade, sendTradeDm]);

  // Ref so submitProposals can call refetchPending (defined later via hook)
  const refetchPendingRef = useRef<() => void>(() => {});

  const submitProposals = useCallback(async () => {
    if (selectedProposals.length === 0) return;
    setSubmitting(true);
    setSubmitProgress(0);
    for (let i = 0; i < selectedProposals.length; i++) {
      const { user_id, _effective, ...vars } = selectedProposals[i];
      const eff = _effective ?? { playersToGive, playersToReceive, picksToGive, picksToReceive };
      try {
        const result = await proposeTrade({ ...vars, ...(expiresAt ? { expires_at: Math.floor(expiresAt / 1000) } : {}) });
        const transaction = result.propose_trade;
        const league = leagues[vars.league_id];

        try {
          await sendTradeDm(
            vars.league_id,
            user_id,
            transaction,
            eff.playersToGive,
            eff.playersToReceive,
            eff.picksToGive,
            eff.picksToReceive,
            "proposed",
            `@${league?.user_roster.username} has proposed a trade in ${league?.name}`,
          );
        } catch (e) {
          console.error(`DM for proposal ${i + 1} failed:`, e);
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
    refetchPendingRef.current();
  }, [
    selectedProposals,
    proposeTrade,
    sendTradeDm,
    leagues,
    playersToGive,
    playersToReceive,
    picksToGive,
    picksToReceive,
  ]);

  const allPlayerIds = useMemo(() => Object.keys(allplayers), [allplayers]);

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
    rosterFilters: { userOwns: string[]; userLacks: string[]; partnerOwns: string[]; partnerLacks: string[] },
  ) => {
    return leagues.filter((league) => {
      const hasPlayersToGive = playersToGive.every((player_id) =>
        league.user_roster.players.includes(player_id),
      );
      const hasPicksToGive = picksToGive.every((pick_id) =>
        league.user_roster.draftpicks.some((p) => getPickId(p) === pick_id),
      );

      // Roster filters on user's roster
      const userOwnsOk = rosterFilters.userOwns.every((pid) =>
        league.user_roster.players.includes(pid),
      );
      const userLacksOk = rosterFilters.userLacks.every((pid) =>
        !league.user_roster.players.includes(pid),
      );
      if (!userOwnsOk || !userLacksOk) return false;

      const otherRosters = league.rosters.filter(
        (roster) => roster.roster_id !== league.user_roster.roster_id,
      );

      const hasPlayerToReceive = otherRosters.some((roster) =>
        playersToReceive.every((player_id) =>
          roster.players.includes(player_id),
        ),
      );

      const hasPicksToReceive = otherRosters.some((roster) =>
        picksToReceive.every((pick_id) =>
          roster.draftpicks.some((p) => getPickId(p) === pick_id),
        ),
      );

      // Partner roster filters: at least one valid trading partner must match
      const partnerFilterActive = rosterFilters.partnerOwns.length > 0 || rosterFilters.partnerLacks.length > 0;
      const partnerFilterOk = !partnerFilterActive || otherRosters.some((roster) =>
        rosterFilters.partnerOwns.every((pid) => roster.players.includes(pid)) &&
        rosterFilters.partnerLacks.every((pid) => !roster.players.includes(pid)),
      );

      return (
        hasPlayersToGive &&
        hasPicksToGive &&
        hasPlayerToReceive &&
        hasPicksToReceive &&
        partnerFilterOk
      );
    });
  };

  const rosterFilters = useMemo(() => ({
    userOwns: userOwnsFilter,
    userLacks: userLacksFilter,
    partnerOwns: partnerOwnsFilter,
    partnerLacks: partnerLacksFilter,
  }), [userOwnsFilter, userLacksFilter, partnerOwnsFilter, partnerLacksFilter]);

  const filteredLeagues = useMemo(
    () =>
      filterLeagues(
        Object.values(leagues),
        playersToGive,
        playersToReceive,
        picksToGive,
        picksToReceive,
        rosterFilters,
      ).map((league) => {
        const tradingWith = league.rosters.filter(
          (roster) =>
            roster.roster_id !== league.user_roster.roster_id &&
            playersToReceive.every((p) => roster.players.includes(p)) &&
            picksToReceive.every((p) =>
              roster.draftpicks.some((d) => getPickId(d) === p),
            ) &&
            partnerOwnsFilter.every((pid) => roster.players.includes(pid)) &&
            partnerLacksFilter.every((pid) => !roster.players.includes(pid)),
        );
        return { ...league, tradingWith };
      }),
    [leagues, playersToGive, playersToReceive, picksToGive, picksToReceive, rosterFilters, partnerOwnsFilter, partnerLacksFilter],
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
  } = useTradesByStatus(leagues, "proposed", undefined, userId);
  refetchPendingRef.current = refetchPending;
  const {
    trades: expiredTrades,
    loading: expiredLoading,
    error: expiredError,
  } = useTradesByStatus(leagues, "expired", undefined, userId);
  const {
    trades: completedTrades,
    loading: completedLoading,
    error: completedError,
  } = useTradesByStatus(leagues, "complete", undefined, userId);
  const {
    trades: rejectedTrades,
    loading: rejectedLoading,
    error: rejectedError,
  } = useTradesByStatus(leagues, "rejected", undefined, userId);

  return (
    <div className="flex flex-col flex-1 items-center w-full gap-6 p-6">
      {/* Tabs */}
      <div className="flex w-full max-w-3xl border-b border-gray-700 overflow-x-auto">
        {(["create", "pending", "expired", "completed", "rejected"] as TradesTab[]).map((t) => {
          const count = t === "pending" ? pendingTrades.length
            : t === "expired" ? expiredTrades.length
            : t === "completed" ? completedTrades.length
            : t === "rejected" ? rejectedTrades.length
            : 0;
          const label = t === "create" ? "Create Trade"
            : t === "pending" ? "Pending"
            : t === "expired" ? "Expired"
            : t === "completed" ? "Completed"
            : "Rejected";
          const badgeColor = t === "pending" ? "bg-yellow-500/20 text-yellow-400"
            : t === "expired" ? "bg-orange-500/20 text-orange-400"
            : t === "completed" ? "bg-green-500/20 text-green-400"
            : "bg-red-500/20 text-red-400";
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
              className={`relative shrink-0 px-5 py-2.5 text-sm font-semibold font-[family-name:var(--font-heading)] tracking-wide uppercase transition ${
                tab === t
                  ? "text-gray-100"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
              {t !== "create" && count > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-xs font-semibold ${badgeColor}`}>
                  {count}
                </span>
              )}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t" />
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
          onCounter={async (data) => {
            await handleCounterOrModify(data, "counter-offered");
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
          onModify={async (data) => {
            await handleCounterOrModify(data, "modified");
            refetchPending();
          }}
        />
      ) : tab === "expired" ? (
        <TradesPanel
          trades={expiredTrades}
          loading={expiredLoading}
          error={expiredError}
          leagues={leagues}
          allplayers={allplayers}
          userId={userId}
          ktc={ktc}
          filter={valueFilter}
          statusLabel="Expired"
          emptyMessage="No expired trades across your leagues."
        />
      ) : tab === "completed" ? (
        <TradesPanel
          trades={completedTrades}
          loading={completedLoading}
          error={completedError}
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
        <div className="flex-1 flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
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
                    className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-1 text-xs text-red-300"
                  >
                    {allplayers[player_id]?.full_name || player_id}
                    {value > 0 && <span className="text-red-400/70 text-xs">{value}</span>}
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
                const value = getPickValue(pick_id, valueFilter.valueLookup);
                return (
                  <span
                    key={pick_id}
                    className="inline-flex items-center gap-1 rounded-full bg-red-900/30 border border-red-800/50 px-2.5 py-1 text-xs text-red-300"
                  >
                    {pick_id}
                    {value > 0 && <span className="text-red-400/70 text-xs">{valueFilter.formatValue(value)}</span>}
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
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Total {valueFilter.valueLabel}</span>
              <span className="text-sm font-semibold text-red-400">
                {valueFilter.formatValue(
                  playersToGive.reduce((sum, pid) => sum + (valueFilter.valueLookup[pid] ?? 0), 0) +
                  picksToGive.reduce((sum, pid) => sum + getPickValue(pid, valueFilter.valueLookup), 0)
                )}
              </span>
            </div>
          )}
        </div>

        {/* Receive side */}
        <div className="flex-1 flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
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
                    className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-1 text-xs text-green-300"
                  >
                    {allplayers[player_id]?.full_name || player_id}
                    {value > 0 && <span className="text-green-400/70 text-xs">{value}</span>}
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
                const value = getPickValue(pick_id, valueFilter.valueLookup);
                return (
                  <span
                    key={pick_id}
                    className="inline-flex items-center gap-1 rounded-full bg-green-900/30 border border-green-800/50 px-2.5 py-1 text-xs text-green-300"
                  >
                    {pick_id}
                    {value > 0 && <span className="text-green-400/70 text-xs">{valueFilter.formatValue(value)}</span>}
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
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Total {valueFilter.valueLabel}</span>
              <span className="text-sm font-semibold text-green-400">
                {valueFilter.formatValue(
                  playersToReceive.reduce((sum, pid) => sum + (valueFilter.valueLookup[pid] ?? 0), 0) +
                  picksToReceive.reduce((sum, pid) => sum + getPickValue(pid, valueFilter.valueLookup), 0)
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expiration picker */}
      <div className="flex items-center gap-3 w-full max-w-3xl rounded-lg border border-gray-700/60 bg-gray-800/50 px-4 py-2.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold shrink-0">Expires</span>
        <div className="flex items-center gap-2">
          {[
            { label: "None", value: null },
            { label: "1 day", value: 1 },
            { label: "2 days", value: 2 },
            { label: "3 days", value: 3 },
            { label: "7 days", value: 7 },
          ].map((opt) => {
            const optMs = opt.value ? Date.now() + opt.value * 86400000 : null;
            const isSelected = opt.value === null
              ? expiresAt === null
              : expiresAt !== null && Math.abs(expiresAt - (optMs ?? 0)) < 86400000;
            return (
              <button
                key={opt.label}
                onClick={() => setExpiresAt(opt.value ? Date.now() + opt.value * 86400000 : null)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                    : "bg-gray-700/60 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-gray-600 ml-1">or</span>
        <input
          type="datetime-local"
          value={expiresAt ? new Date(expiresAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
          min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
          onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).getTime() : null)}
          className="rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500/50 focus:outline-none transition"
        />
        {expiresAt && (
          <button
            onClick={() => setExpiresAt(null)}
            className="text-[10px] text-red-400 hover:text-red-300 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Roster filters — narrow by ownership without adding to trade */}
      <div className="flex gap-4 w-full max-w-3xl">
        <div className="flex-1 flex flex-col gap-2 rounded-lg border border-gray-700/60 bg-gray-800/50 p-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">You own (filter)</h4>
          <PlayerCombobox
            id="filter-user-owns"
            playerIds={allPlayerIds}
            allplayers={allplayers}
            selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
            onSelect={(pid) => setUserOwnsFilter((prev) => prev.includes(pid) ? prev : [...prev, pid])}
            placeholder="Must own..."
          />
          {userOwnsFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {userOwnsFilter.map((pid) => (
                <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-blue-900/20 border border-blue-800/40 px-2 py-0.5 text-[11px] text-blue-300">
                  {allplayers[pid]?.full_name || pid}
                  <button onClick={() => setUserOwnsFilter((p) => p.filter((x) => x !== pid))} className="text-blue-400 hover:text-blue-300">&times;</button>
                </span>
              ))}
            </div>
          )}
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-1">You don't own (filter)</h4>
          <PlayerCombobox
            id="filter-user-lacks"
            playerIds={allPlayerIds}
            allplayers={allplayers}
            selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
            onSelect={(pid) => setUserLacksFilter((prev) => prev.includes(pid) ? prev : [...prev, pid])}
            placeholder="Must NOT own..."
          />
          {userLacksFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {userLacksFilter.map((pid) => (
                <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-orange-900/20 border border-orange-800/40 px-2 py-0.5 text-[11px] text-orange-300">
                  {allplayers[pid]?.full_name || pid}
                  <button onClick={() => setUserLacksFilter((p) => p.filter((x) => x !== pid))} className="text-orange-400 hover:text-orange-300">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 rounded-lg border border-gray-700/60 bg-gray-800/50 p-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Partner owns (filter)</h4>
          <PlayerCombobox
            id="filter-partner-owns"
            playerIds={allPlayerIds}
            allplayers={allplayers}
            selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
            onSelect={(pid) => setPartnerOwnsFilter((prev) => prev.includes(pid) ? prev : [...prev, pid])}
            placeholder="Partner must own..."
          />
          {partnerOwnsFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {partnerOwnsFilter.map((pid) => (
                <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-blue-900/20 border border-blue-800/40 px-2 py-0.5 text-[11px] text-blue-300">
                  {allplayers[pid]?.full_name || pid}
                  <button onClick={() => setPartnerOwnsFilter((p) => p.filter((x) => x !== pid))} className="text-blue-400 hover:text-blue-300">&times;</button>
                </span>
              ))}
            </div>
          )}
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-1">Partner doesn't own (filter)</h4>
          <PlayerCombobox
            id="filter-partner-lacks"
            playerIds={allPlayerIds}
            allplayers={allplayers}
            selected={[...userOwnsFilter, ...userLacksFilter, ...partnerOwnsFilter, ...partnerLacksFilter]}
            onSelect={(pid) => setPartnerLacksFilter((prev) => prev.includes(pid) ? prev : [...prev, pid])}
            placeholder="Partner must NOT own..."
          />
          {partnerLacksFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {partnerLacksFilter.map((pid) => (
                <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-orange-900/20 border border-orange-800/40 px-2 py-0.5 text-[11px] text-orange-300">
                  {allplayers[pid]?.full_name || pid}
                  <button onClick={() => setPartnerLacksFilter((p) => p.filter((x) => x !== pid))} className="text-orange-400 hover:text-orange-300">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Potential trades */}
      <div className="w-full max-w-4xl">
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
            tradeBlockByLeague={tradeBlockByLeague}
          />
        )}
      </div>
      </>
      )}
    </div>
  );
}
