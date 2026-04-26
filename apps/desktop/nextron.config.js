module.exports = {
  webpack: (config) => {
    // Nextron sets externals as an array of package name strings.
    // Remove pg-related packages from externals so webpack bundles them.
    // This fixes pnpm's transitive dep resolution issues in the Electron asar.

    const BUNDLE = new Set([
      'pg', 'pg-cloudflare', 'pg-connection-string', 'pg-int8', 'pg-numeric',
      'pg-pool', 'pg-protocol', 'pg-types', 'pgpass',
      'postgres-array', 'postgres-bytea', 'postgres-date',
      'postgres-interval', 'postgres-range',
    ]);

    if (Array.isArray(config.externals)) {
      config.externals = config.externals.filter((ext) => {
        if (typeof ext === 'string') return !BUNDLE.has(ext);
        return true;
      });
    }

    return config;
  },
};
