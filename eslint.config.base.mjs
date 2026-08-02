// Shared flat ESLint config for the Node/TypeScript packages in this workspace
// (apps/worker, packages/db, packages/services, packages/shared).
// apps/web has its own eslint.config.mjs built on eslint-config-next instead.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    rules: {
      // Catches circular imports between/within workspace packages at lint time.
      "import-x/no-cycle": "error",
    },
  },
  {
    // Mirrors the root .gitignore build/output entries — these directories
    // hold bundled or generated JS (esbuild output, CDK-synthesized Lambda
    // assets), never hand-written source, so they should never be linted.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/cdk.out/**",
      "**/coverage/**",
    ],
  },
);
