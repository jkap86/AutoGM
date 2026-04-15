"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeaguesPayload } from "@sleepier/shared";
import { deriveCollections } from "@sleepier/shared";

export function useLeagues({
  user_id,
  season,
}: {
  user_id: string | null | undefined;
  season: string;
}) {
  const [data, setData] = useState<LeaguesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user_id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    window.ipc
      .invoke<LeaguesPayload>("leagues:fetch", { user_id, season })
      .then(
        (payload) => {
          if (cancelled) return;
          setData(payload);
          setLoading(false);
        },
        (e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        },
      );

    return () => {
      cancelled = true;
    };
  }, [user_id, season]);

  // Derive once per fetch. useMemo skips work when `data` is the same
  // reference (e.g. on unrelated re-renders of the consuming component).
  const { player_shares, leaguemates, pick_shares } = useMemo(
    () => deriveCollections(data ? Object.values(data.leagues) : []),
    [data],
  );

  return {
    user: data?.user ?? null,
    leagues: data?.leagues ?? null,
    playerShares: player_shares,
    leaguemates,
    pickShares: pick_shares,
    loading,
    error,
  };
}
