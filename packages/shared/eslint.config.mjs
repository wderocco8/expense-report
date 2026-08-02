import baseConfig from "../../eslint.config.base.mjs";

export default [
  ...baseConfig,
  {
    rules: {
      // packages/shared is the base layer of the dependency graph — nothing
      // else in the workspace may end up beneath it.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@repo/db", "@repo/db/*", "@repo/services", "@repo/services/*"],
              message: "packages/shared must not depend on @repo/db or @repo/services — shared is the base layer of the dependency graph.",
            },
          ],
        },
      ],
    },
  },
];
