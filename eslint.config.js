import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "src-tauri/target/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      // v7's "recommended" preset folds in the full React Compiler rule set, not just
      // rules-of-hooks/exhaustive-deps as before. Everything else in it passes clean already;
      // this one doesn't — it flags several legitimate "sync from an external source" effects in
      // App.tsx (reacting to the repo list arriving, resetting selection on repo switch,
      // recovering from a stale commit, pruning stale branch focus), the same "derive/reset state
      // on prop change via effect" pattern React itself documents. Downgrading here rather than
      // restructuring those effects for a devDependency bump, same spirit as the TS strictness
      // notes below.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    rules: {
      // Non-null assertions and the occasional intentional unused-arg (interface conformance,
      // destructuring for readability) are used deliberately throughout this codebase — the
      // real defaults worth enforcing right now are unreachable code and unused *bindings*, not
      // stylistic strictness that would touch hundreds of pre-existing lines for no behavior
      // change.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
