const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load .env at build time so we can inject values into the production bundle
const env = dotenv.config({ path: path.join(__dirname, '.env') }).parsed || {};

module.exports = {
  webpack: (config) => {
    // Inject env vars as build-time constants for production.
    // Only inject non-empty values so that || fallbacks still work
    // for optional vars like LOGIN_URL and PW_CHANNEL.
    const defines = {};
    for (const [key, val] of Object.entries(env)) {
      if (val) {
        defines[`process.env.${key}`] = JSON.stringify(val);
      }
    }
    config.plugins.push(new webpack.DefinePlugin(defines));

    return config;
  },
};
