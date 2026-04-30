"use client";

import { useEffect, useState } from "react";

type NflState = {
  week: number;
  leg: number;
  season: string;
  season_type: string;
};

export function useNflState() {
  const [state, setState] = useState<NflState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.sleeper.app/v1/state/nfl")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return state;
}
