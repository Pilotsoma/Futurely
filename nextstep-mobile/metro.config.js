const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const { resolve } = require('metro-resolver')

const MONOREPO_ROOT = path.resolve(__dirname, '..')

const config = getDefaultConfig(__dirname)

// Only src/constants/legalText.ts re-exports from outside this package (from
// the monorepo-root lib/legalText.ts, its canonical source — see that file).
// Scope watchFolders to just that shared directory rather than the whole
// monorepo root, so Metro's file watcher doesn't also cover the unrelated
// Next.js web app, the Express backend, and their node_modules/.next output —
// that bloats file-watch overhead and slows Metro startup/HMR for no benefit.
config.watchFolders = [path.join(MONOREPO_ROOT, 'lib')]

// Metro 0.84 (Expo SDK 56) changed context.resolveRequest to point to the
// custom resolver itself, not Metro's built-in resolver. NativeWind's
// resolveRequest does `originalResolver ?? context.resolveRequest` — without
// a pre-set originalResolver it recurses infinitely. We break the cycle by
// providing a base resolver that always calls Metro's built-in resolve().
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // ReactDevToolsSettingsManager only ships as .android.js/.ios.js — no web build exists
  if (platform === 'web' && moduleName.includes('ReactDevToolsSettingsManager')) {
    return { type: 'empty' }
  }
  return resolve({ ...context, resolveRequest: null }, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
