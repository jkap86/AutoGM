import { useEffect, useMemo, useRef, useState } from "react";
import {
  Allplayer,
  LeagueDetailed,
  Leaguemates,
  PickShares,
  PlayerShares,
} from "../../../main/lib/types";
import { getPickId } from "../../lib/leagues";

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

      return hasPlayersToGive && hasPicksToGive && hasPlayerToReceive;
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
        const tradingWith = league.rosters.filter((roster) =>
          playersToReceive.every((p) => roster.players.includes(p)),
        );
        return { ...league, tradingWith };
      }),
    [leagues, playersToGive, playersToReceive, picksToGive, picksToReceive],
  );

  return (
    <div className="flex flex-col flex-1 items-center w-full">
      <div className="flex gap-8">
        <div className="flex flex-col">
          <div className="flex flex-col items-center">
            <label htmlFor="players-to-give">Players to give:</label>
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
            />
          </div>
          <div className="flex flex-col items-center mt-4">
            <label htmlFor="picks-to-give">Picks to give:</label>
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
            />
          </div>
          <ul className="mt-4">
            {playersToGive.map((player_id) => (
              <li
                key={player_id}
                className="text-sm text-gray-300 flex items-center gap-2 text-[2rem]"
              >
                <span>{allplayers[player_id]?.full_name || player_id}</span>
                <button
                  onClick={() =>
                    setPlayerstoGive((prev) =>
                      prev.filter((p) => p !== player_id),
                    )
                  }
                  className="text-red-400 hover:text-red-500"
                >
                  &times;
                </button>
              </li>
            ))}
            {picksToGive.map((pick_id) => (
              <li
                key={pick_id}
                className="text-sm text-gray-300 flex items-center gap-2 text-[2rem]"
              >
                <span>{pick_id}</span>
                <button
                  onClick={() =>
                    setPicksToGive((prev) => prev.filter((p) => p !== pick_id))
                  }
                  className="text-red-400 hover:text-red-500"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col">
          <div className="flex flex-col items-center">
            <label htmlFor="players-to-receive">Players to receive:</label>
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
            />
          </div>
          <div className="flex flex-col items-center mt-4">
            <label htmlFor="picks-to-receive">Picks to receive:</label>
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
            />
            <ul className="mt-4">
              {playersToReceive.map((player_id) => (
                <li
                  key={player_id}
                  className="text-sm text-gray-300 flex items-center gap-2 text-[2rem]"
                >
                  <span>{allplayers[player_id]?.full_name || player_id}</span>
                  <button
                    onClick={() =>
                      setPlayersToReceive((prev) =>
                        prev.filter((p) => p !== player_id),
                      )
                    }
                    className="text-red-400 hover:text-red-500"
                  >
                    &times;
                  </button>
                </li>
              ))}
              {picksToReceive.map((pick_id) => (
                <li
                  key={pick_id}
                  className="text-sm text-gray-300 flex items-center gap-2 text-[2rem]"
                >
                  <span>{pick_id}</span>
                  <button
                    onClick={() =>
                      setPicksToReceive((prev) =>
                        prev.filter((p) => p !== pick_id),
                      )
                    }
                    className="text-red-400 hover:text-red-500"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl mb-4">Potential Trades:</h2>

        {(playersToGive.length === 0 &&
          playersToReceive.length === 0 &&
          picksToGive.length === 0 &&
          picksToReceive.length === 0 && (
            <p className="text-gray-400">
              Select players or picks to give/receive to see potential trades.
            </p>
          )) ||
        filteredLeagues.length === 0 ? (
          <p className="text-gray-400">No potential trades found.</p>
        ) : (
          <div>
            {filteredLeagues.map((league) => (
              <div key={league.league_id} className="mb-4">
                <h3 className="text-xl font-bold">
                  {league.name} (trading with:{" "}
                  {league.tradingWith.map((r) => (
                    <div key={r.username}>{r.username}</div>
                  ))}
                  )
                </h3>
              </div>
            ))}
          </div>
        )}
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
}: {
  id: string;
  playerIds: string[];
  allplayers: { [player_id: string]: Allplayer };
  selected: string[];
  onSelect: (player_id: string) => void;
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
    <div ref={wrapperRef} className="relative w-64 text-[2rem]">
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
        placeholder="Search players…"
        className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xl text-gray-100"
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
                className={`flex cursor-pointer items-center justify-between px-2 py-1 text-xl ${
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
