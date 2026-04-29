const path = require('path')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(projectRoot)

// Watch the shared package source
config.watchFolders = [monorepoRoot]

// Resolve modules from the project, monorepo root, and pnpm virtual store
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
  'C:\\.pnpm\\node_modules',
]

module.exports = withNativeWind(config, { input: './global.css' })
