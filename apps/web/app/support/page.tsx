export const metadata = {
  title: "Support - AutoGM",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200 px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Support</h1>

        <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Get Help</h2>
          <p className="text-sm text-gray-300 leading-relaxed mb-4">
            AutoGM is a fantasy football management tool for Sleeper.com leagues.
            If you need help or have questions, reach out through one of the channels below.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-1">GitHub Issues</h3>
              <p className="text-sm text-gray-400">
                Report bugs or request features on our{" "}
                <a
                  href="https://github.com/jkap86/AutoGM/issues"
                  className="text-blue-400 hover:text-blue-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub repository
                </a>.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-1">Email</h3>
              <p className="text-sm text-gray-400">
                For account or access issues, email{" "}
                <a
                  href="mailto:autogm.support@gmail.com"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  autogm.support@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">FAQ</h2>
          <div className="space-y-4">
            <Faq
              q="How do I log in?"
              a="AutoGM uses your Sleeper.com account. Tap 'Sign in with Sleeper' and log in with your Sleeper credentials. AutoGM never sees or stores your password."
            />
            <Faq
              q="Why do I see 'Access Denied'?"
              a="AutoGM is currently in a closed beta. Access is managed via an invite list. Contact us if you'd like to request access."
            />
            <Faq
              q="Is AutoGM affiliated with Sleeper?"
              a="No. AutoGM is an independent third-party tool that uses Sleeper's public APIs. It is not endorsed by or affiliated with Sleeper."
            />
            <Faq
              q="How do I delete my data?"
              a="Sign out of the app to remove all locally stored data. Uninstalling the app also clears all data. AutoGM does not store your data on any server."
            />
            <Faq
              q="Which platforms are supported?"
              a="AutoGM is available on iOS (TestFlight), Windows, macOS, and Linux."
            />
          </div>
        </div>

        <div className="text-center">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-300 underline">
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-200">{q}</h3>
      <p className="text-sm text-gray-400 mt-1">{a}</p>
    </div>
  );
}
