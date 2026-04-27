const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

// Ensure metro resolves from the mobile app's own dependencies first,
// not hoisted root node_modules which may have version mismatches.
const mobileModules = path.resolve(projectRoot, 'node_modules')
const originalResolve = require.resolve
const patchedPaths = [mobileModules, path.resolve(monorepoRoot, 'node_modules')]

const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(projectRoot)

// Watch the shared package source
config.watchFolders = [monorepoRoot]

// Resolve modules from both the project and monorepo root
config.resolver.nodeModulesPaths = patchedPaths

module.exports = config
