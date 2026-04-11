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
