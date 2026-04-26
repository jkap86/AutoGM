module.exports = {
  webpack: (config) => {
    // By default Nextron externalizes all node_modules for the main process.
    // With pnpm, transitive deps (like pg-types) can't be resolved at runtime
    // inside the asar. Override externals to bundle pg and its deps directly.
    const origExternals = config.externals || [];

    config.externals = function (ctx, callback) {
      const request = ctx.request || ctx;

      // Bundle pg and all pg-* sub-packages into the main process
      if (typeof request === 'string' && (request === 'pg' || request.startsWith('pg-') || request.startsWith('pg/'))) {
        return callback();
      }

      // Bundle @sleepier/shared into the main process
      if (typeof request === 'string' && request.startsWith('@sleepier/')) {
        return callback();
      }

      // Keep everything else external
      if (typeof origExternals === 'function') {
        return origExternals(ctx, callback);
      }
      if (Array.isArray(origExternals)) {
        for (const ext of origExternals) {
          if (typeof ext === 'function') {
            return ext(ctx, callback);
          }
          if (typeof ext === 'string' && ext === request) {
            return callback(null, `commonjs ${request}`);
          }
          if (ext instanceof RegExp && ext.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
        }
      }
      return callback();
    };

    return config;
  },
};
