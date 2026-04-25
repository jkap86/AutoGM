const features = [
  {
    icon: "🔄",
    title: "Trade Automation",
    description:
      "Send batch trades across all your leagues in seconds. Target specific leaguemates, filter by league type, and let Sleepier handle the repetitive clicking.",
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
      "Built-in KeepTradeCut dynasty player values with historical trends. See real-time trade value comparisons without leaving the app.",
  },
  {
    icon: "🎯",
    title: "ADP Research",
    description:
      "Browse consensus ADP data to inform your draft strategy. Filter by draft type, league settings, scoring format, and more.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">
          What Sleepier Does
        </h2>
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
