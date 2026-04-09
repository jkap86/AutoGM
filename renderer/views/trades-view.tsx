import {
  LeagueDetailed,
  Leaguemates,
  PickShares,
  PlayerShares,
} from "../../main/lib/types";

export default function TradesView({
  leagues,
  playerShares,
  leaguemates,
  pickShares,
}: {
  leagues: {
    [league_id: string]: LeagueDetailed;
  };
  playerShares: PlayerShares;
  leaguemates: Leaguemates;
  pickShares: PickShares;
}) {
  return <div className="flex flex-col flex-1 items-center w-full"></div>;
}
