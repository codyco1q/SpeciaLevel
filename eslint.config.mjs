import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat config.
 * `eslint-config-next` v16 ships native flat config presets
 * (core-web-vitals rules + TypeScript rules).
 */
const eslintConfig = [...nextVitals, ...nextTypescript];

export default eslintConfig;