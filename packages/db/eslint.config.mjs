import baseConfig from "../../eslint.config.base.mjs";

export default [
  ...baseConfig,
  {
    rules: {
      // packages/db sits below packages/services in the dependency graph.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@repo/services", "@repo/services/*"],
              message: "packages/db must not depend on @repo/services — db sits below services in the dependency graph.",
            },
          ],
        },
      ],
    },
  },
];
