// eslint-config-next ships native flat configs from v16, so these are spread
// directly. The FlatCompat wrapper this used before Next 16 now throws.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Destructuring alongside a rest element is how we omit columns when
      // copying a row (see duplicateProduct); those bindings are meant to be
      // unused.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  { ignores: [".next/**", "node_modules/**"] },
];

export default config;
