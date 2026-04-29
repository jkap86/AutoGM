const features = [
  {
    icon: "🔄",
    title: "Batch Trades",
    description:
      "Build a trade once and send it to every matching league in seconds. Filter by league type, roster ownership, and trade partner. See real-time KTC value comparisons on every proposal, and get a clear success/failure summary when the batch finishes.",
  },
  {
    icon: "📋",
    title: "Batch Waivers",
    description:
      "Submit waiver claims across all your leagues at once. Set a master bid or per-league overrides, filter by dynasty/keeper/redraft, and see exactly which claims succeeded and which failed with per-league error details.",
  },
  {
    icon: "💬",
    title: "DMs & League Messages",
    description:
      "Message any leaguemate directly from the app. Browse all your DM conversations sorted by recent activity, search by user or league, and send trade attachment DMs alongside proposals.",
  },
  {
    icon: "📊",
    title: "League Polls",
    description:
      "Create and send polls to all your leagues at once. Perfect for rule changes, schedule votes, or just engaging your leaguemates.",
  },
  {
    icon: "📈",
    title: "KTC Dynasty Values",
    description:
      "Built-in KeepTradeCut dynasty player values with historical trends. See value comparisons on trades, waivers, and your roster without leaving the app.",
  },
  {
    icon: "🎯",
    title: "ADP & Opponent Scouting",
    description:
      "Browse consensus ADP data filtered by draft type, league settings, and scoring format. Scout opponents by reviewing their draft history and recent trade activity across leagues.",
  },
  {
    icon: "🛡️",
    title: "Built for Safety",
    description:
      "Every mutation goes through a dedicated channel with idempotency protection to prevent duplicate trades, waivers, and messages. Your Sleeper token is encrypted on disk and never sent to our servers.",
  },
  {
    icon: "📡",
    title: "Real-Time Updates",
    description:
      "Live WebSocket connection to Sleeper keeps your leagues, trades, and notifications up to date without refreshing.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          Everything You Need
        </h2>
        <p className="text-center text-gray-400 max-w-2xl mx-auto mb-14">
          Manage all your Sleeper leagues from one place. No more clicking through each league one at a time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
