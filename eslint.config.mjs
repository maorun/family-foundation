import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals.map((config) => {
    if (config.languageOptions?.parser?.meta?.name === "eslint-config-next/parser") {
      const { parser: _parser, ...languageOptions } = config.languageOptions;
      return {
        ...config,
        languageOptions: {
          ...languageOptions,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: { jsx: true },
          },
        },
      };
    }
    return config;
  }),
  {
    settings: {
      react: { version: "19" },
    },
  },
  globalIgnores([".next/**", "out/**", "build/**"]),
]);
