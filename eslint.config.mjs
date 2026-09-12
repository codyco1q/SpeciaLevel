import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat config.
 * `eslint-config-next` v16 ships native flat config presets
 * (core-web-vitals rules + TypeScript rules).
 *
 * Build artifacts and generated files are ignored so `eslint .` only
 * lints source code (and finishes fast instead of scanning `.next`).
 */
const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "data/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;