module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    // Disable no-undef for TypeScript files - TypeScript handles this better
    "no-undef": "off",
    // Enforce declaration before use to prevent temporal dead zone errors and improve readability
    "@typescript-eslint/no-use-before-define": [
      "error",
      {
        functions: true,
        classes: true,
        variables: true,
        enums: true,
        typedefs: true,
        ignoreTypeReferences: true,
      },
    ],
  },
  overrides: [
    {
      // Allow console in the centralized logger utility
      files: ["src/lib/logger.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
