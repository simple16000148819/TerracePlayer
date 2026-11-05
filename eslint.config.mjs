import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "release/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["scripts/smoke.cjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
