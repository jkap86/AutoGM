const RELEASE_BASE =
  "https://github.com/jkap86/AutoGM/releases/latest/download";

const VERSION = "1.0.0";

const platforms = [
  {
    name: "Windows",
    icon: "🪟",
    available: true,
    label: "Download for Windows",
    detail: `v${VERSION} · .exe installer`,
    href: `${RELEASE_BASE}/AutoGM-${VERSION}-win-x64.exe`,
  },
  {
    name: "macOS",
    icon: "🍎",
    available: true,
    label: "Download for macOS",
    detail: `v${VERSION} · Intel & Apple Silicon · .dmg`,
    href: `${RELEASE_BASE}/AutoGM-${VERSION}-mac-arm64.dmg`,
  },
  {
    name: "Linux",
    icon: "🐧",
    available: true,
    label: "Download for Linux",
    detail: `v${VERSION} · .AppImage`,
    href: `${RELEASE_BASE}/AutoGM-${VERSION}-linux-x64.AppImage`,
  },
];

export default function Download() {
  return (
    <section id="download" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">
          Download AutoGM
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {platforms.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl p-6 text-center flex flex-col items-center gap-4 ${
                p.available
                  ? "bg-gray-900 border border-blue-600/40"
                  : "bg-gray-900/50 border border-gray-800"
              }`}
            >
              <span className="text-4xl">{p.icon}</span>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <a
                href={p.href}
                className={`w-full py-3 rounded-lg font-bold text-sm transition ${
                  p.available
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed pointer-events-none"
                }`}
              >
                {p.label}
              </a>
              <p className="text-xs text-gray-500">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
