import Image from "next/image";

export default function Hero() {
  return (
    <section
      id="hero"
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16"
    >
      <Image
        src="/images/logo.png"
        alt="AutoGM logo"
        width={180}
        height={180}
        className="mb-8"
        priority
      />
      <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
        Fantasy Football on Autopilot
      </h1>
      <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mb-8">
        Automate trades, polls, and roster analysis across all your Sleeper
        leagues.
      </p>
      <a
        href="#download"
        className="text-white font-bold px-8 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition text-lg"
      >
        Download for Windows
      </a>
      <p className="mt-4 text-sm text-gray-500">
        Windows 10+ &middot; v1.0.0 &middot; Free
      </p>
    </section>
  );
}
