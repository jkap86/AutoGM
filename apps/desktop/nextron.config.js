module.exports = {
  webpack: (config) => {
    // Nextron externalizes all node_modules for the main process.
    // With pnpm, transitive deps can't be resolved at runtime in the asar.
    // Bundle pg and all its transitive deps into background.js.

    // Packages that must stay external (Electron/native modules)
    const EXTERNAL = new Set([
      'electron',
      'electron-serve',
      'electron-store',
      'playwright-core',
      'dotenv',
      'dotenv/config',
    ]);

    function isExternal(request) {
      if (!request) return false;
      // Exact match or subpath (e.g. dotenv/config)
      if (EXTERNAL.has(request)) return true;
      // Node built-ins
      if (request.startsWith('node:')) return true;
      if (/^(fs|path|crypto|net|tls|dns|events|util|stream|string_decoder|os|http|https|child_process|buffer|url)$/.test(request)) return true;
      // @babel/runtime-corejs3 — used by electron-store, must be external
      if (request.startsWith('@babel/runtime-corejs3')) return true;
      return false;
    }

    function isNodeModule(request) {
      if (!request) return false;
      if (request.startsWith('.') || request.startsWith('/') || request.startsWith('!')) return false;
      if (/^[A-Z]:\\/.test(request)) return false;
      return true;
    }

    config.externals = [
      function ({ request }, callback) {
        if (isExternal(request)) {
          return callback(null, `commonjs ${request}`);
        }
        // Bundle everything else (pg, pg-types, pgpass, postgres-*, @sleepier/shared, etc.)
        if (isNodeModule(request)) {
          return callback();
        }
        return callback();
      },
    ];

    return config;
  },
};
