const requirements = [
  { label: "Operating System", value: "Windows 10 or later (64-bit)" },
  { label: "RAM", value: "4 GB minimum" },
  { label: "Disk Space", value: "~150 MB" },
  { label: "Display", value: "1280 x 720 or higher" },
  { label: "Network", value: "Internet connection required" },
  { label: "Browser", value: "Google Chrome (used for Sleeper login)" },
];

export default function SystemRequirements() {
  return (
    <section id="requirements" className="py-24 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">
          System Requirements
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <dl className="divide-y divide-gray-800">
            {requirements.map((r) => (
              <div
                key={r.label}
                className="flex justify-between py-3 first:pt-0 last:pb-0"
              >
                <dt className="text-gray-400 font-medium">{r.label}</dt>
                <dd className="text-white text-right">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs text-gray-500">
            PostgreSQL is optional and only needed for KTC dynasty values and ADP
            research features.
          </p>
        </div>
      </div>
    </section>
  );
}
