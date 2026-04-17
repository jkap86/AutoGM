'use client'

import { useState } from 'react'

const AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs";

export function Avatar({
  hash,
  alt,
  size = 40,
}: {
  hash: string | null | undefined;
  alt: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (alt?.[0] || "?").toUpperCase();

  if (!hash || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-300"
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
        title={alt}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={`${AVATAR_BASE}/${hash}`}
      alt={alt}
      title={alt}
      width={size}
      height={size}
      className="rounded-full shrink-0 bg-gray-700 object-cover"
      onError={() => setFailed(true)}
    />
  );
}
