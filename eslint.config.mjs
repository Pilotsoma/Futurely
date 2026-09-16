import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Setting state synchronously inside useEffect is valid when reading
      // from synchronous APIs like localStorage or when doing initial setup.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // nextstep-mobile/ is a separate Expo/React Native app with its own
    // eslint config (`npm run lint` inside nextstep-mobile/) — these
    // Next.js/web rules (jsx-a11y DOM checks, etc.) don't apply to it.
    "nextstep-mobile/**",
  ]),
]);

export default eslintConfig;
