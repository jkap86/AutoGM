"use client";

import { useEffect, useMemo, useState } from "react";
import type { Allplayer } from "@autogm/shared";

export function useAllPlayers() {
  const [data, setData] = useState<Allplayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    window.ipc.invoke<Allplayer[]>("allplayers:fetch").then(
      (allplayers) => {
        if (cancelled) return;
        setData(allplayers);
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
  }, []);

  const allplayers = useMemo(() => {
    if (!data) return {};

    return Object.fromEntries(data.map((player) => [player.player_id, player]));
  }, [data]);

  return { allplayers, loading, error };
}
