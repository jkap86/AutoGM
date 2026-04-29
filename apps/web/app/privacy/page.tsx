export const metadata = {
  title: "Privacy Policy - AutoGM",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200 px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 27, 2026</p>

        <Section title="Overview">
          <p>
            AutoGM is a fantasy football automation tool that connects to your Sleeper.com account
            to batch trades, waivers, polls, DMs, and research across all your leagues. We are
            committed to protecting your privacy. This policy explains what data we collect, how
            we use it, and your rights.
          </p>
        </Section>

        <Section title="Data We Collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Sleeper Account Information:</strong> When you log in, we access your Sleeper
              user ID, display name, and avatar through Sleeper{"'"}s public API. We do not store your
              Sleeper password.
            </li>
            <li>
              <strong>Session Token:</strong> Your Sleeper authentication token is stored securely
              on your device using encrypted storage (SecureStore on iOS, Electron safeStorage
              on desktop). It is never transmitted to our servers.
            </li>
            <li>
              <strong>League Data:</strong> We fetch your league rosters, trades, waivers, draft picks,
              and messages from Sleeper{"'"}s API to display in the app. This data is not stored on our servers.
            </li>
            <li>
              <strong>Access List:</strong> We maintain a list of authorized user IDs to control
              access during the beta period. This list contains only Sleeper user IDs.
            </li>
          </ul>
        </Section>

        <Section title="Data We Do NOT Collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not collect analytics or usage tracking data.</li>
            <li>We do not sell or share your data with third parties.</li>
            <li>We do not store your Sleeper password or credentials on any server.</li>
            <li>We do not use cookies or tracking pixels.</li>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          <p>
            Your Sleeper data is used solely to display your leagues, facilitate trades, waivers,
            polls, and messages, and provide fantasy football management features within the app.
            Sleeper API calls are made directly between your device and Sleeper{"'"}s servers.
            KTC, ADP, and opponent scouting data is served by our API and does not include your
            personal information.
          </p>
        </Section>

        <Section title="Data Storage">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Mobile (iOS):</strong> Session tokens are stored in the iOS Keychain via
              expo-secure-store. League data is cached in memory only.
            </li>
            <li>
              <strong>Desktop (Windows/Mac/Linux):</strong> Session tokens are encrypted using
              your operating system{"'"}s secure storage (Electron safeStorage) and stored locally.
              League data is cached in memory only.
            </li>
          </ul>
        </Section>

        <Section title="Third-Party Services">
          <p>AutoGM interacts with the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Sleeper.com:</strong> For league data, trades, waivers, polls, and messaging.</li>
            <li><strong>KeepTradeCut:</strong> For dynasty player trade values (via our API, no personal data sent).</li>
            <li><strong>Tenor (Google):</strong> For GIF search in chat. Search queries are sent to Tenor{"'"}s API.</li>
          </ul>
        </Section>

        <Section title="Data Deletion">
          <p>
            You can delete all locally stored data by signing out of the app or uninstalling it.
            To request removal from the access list, contact us at the support page.
          </p>
        </Section>

        <Section title="Children">
          <p>
            AutoGM is not intended for use by children under 13. We do not knowingly collect
            data from children.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy from time to time. Changes will be posted on this page
            with an updated date.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For privacy questions, contact us at{" "}
            <a href="/support" className="text-blue-400 hover:text-blue-300 underline">
              our support page
            </a>.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-300 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
