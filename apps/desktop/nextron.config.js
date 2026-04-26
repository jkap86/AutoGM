const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load .env at build time so we can inject values into the production bundle
const env = dotenv.config({ path: path.join(__dirname, '.env') }).parsed || {};

module.exports = {
  webpack: (config) => {
    // Inject .env values as build-time constants for production.
    // In dev, dotenv loads at runtime; in production, these are baked in.
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL || ''),
        'process.env.ALLOWLIST_URL': JSON.stringify(env.ALLOWLIST_URL || ''),
        'process.env.LOG_LEVEL': JSON.stringify(env.LOG_LEVEL || 'info'),
        'process.env.PW_CHANNEL': JSON.stringify(env.PW_CHANNEL || ''),
        'process.env.LOGIN_URL': JSON.stringify(env.LOGIN_URL || ''),
      }),
    );

    // Nextron sets externals as an array of package name strings.
    // Remove pg-related packages from externals so webpack bundles them.
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
