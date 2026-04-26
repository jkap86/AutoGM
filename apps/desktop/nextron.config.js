const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load .env at build time so we can inject values into the production bundle
const env = dotenv.config({ path: path.join(__dirname, '.env') }).parsed || {};

module.exports = {
  webpack: (config) => {
    // Inject env vars as build-time constants for production.
    // In dev, dotenv loads at runtime; in production, these are baked in.
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.API_URL': JSON.stringify(env.API_URL || ''),
        'process.env.ALLOWLIST_URL': JSON.stringify(env.ALLOWLIST_URL || ''),
        'process.env.LOG_LEVEL': JSON.stringify(env.LOG_LEVEL || 'info'),
        'process.env.PW_CHANNEL': JSON.stringify(env.PW_CHANNEL || ''),
        'process.env.LOGIN_URL': JSON.stringify(env.LOGIN_URL || ''),
      }),
    );

    return config;
  },
};
