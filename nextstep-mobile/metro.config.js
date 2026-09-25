const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const { resolve } = require('metro-resolver')

const config = getDefaultConfig(__dirname)

// Signup validation rules are shared with the backend and web app
// (../backend/src/shared/signupValidation.ts). Metro only bundles files inside
// the project root or watchFolders, so that one folder is added explicitly.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../backend/src/shared'),
]

// Metro 0.83 (Expo SDK 54) has context.resolveRequest point to the
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
