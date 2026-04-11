import type { LeagueDetailed, Roster } from "../../../../main/lib/types";
import type { ProposeTradeVars } from "../../../../main/graphql/queries/types";
import { getPickId } from "../../../lib/leagues";
import { Avatar } from "../../components/avatar";

function formatRecord(r: { wins: number; losses: number; ties: number }) {
  return r.ties > 0
    ? `${r.wins}-${r.losses}-${r.ties}`
    : `${r.wins}-${r.losses}`;
}

export function PotentialTrades({
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
                            `${pick.roster_id},${pick.season},${pick.round},${partner.roster_id},${league.user_roster.roster_id}`,
                          ];
                        }),
                        ...picksToReceive.flatMap((pickId) => {
                          const pick = partner.draftpicks.find(
                            (d) => getPickId(d) === pickId,
                          );
                          if (!pick) return [];
                          return [
                            `${pick.roster_id},${pick.season},${pick.round},${league.user_roster.roster_id},${partner.roster_id}`,
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
