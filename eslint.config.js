// https://docs.expo.dev/guides/using-eslint/
//
// Lint tooling is split between two tools (see biome.json):
//   * Biome  — formatting, import organization, and general JS/TS lint
//              (unused variables, array-type style, correctness/suspicious).
//   * ESLint — React, React Native and Expo *semantics* that Biome doesn't
//              cover (rules of hooks, unescaped JSX entities, import graph).
// To stop the two from double-reporting, the rules Biome already owns are
// turned off here.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const jsdoc = require("eslint-plugin-jsdoc");

module.exports = defineConfig([
	expoConfig,
	{
		rules: {
			// Owned by Biome (correctness/noUnusedVariables + noUnusedImports).
			"@typescript-eslint/no-unused-vars": "off",
			"no-unused-vars": "off",
			// Owned by Biome (style/useConsistentArrayType).
			"@typescript-eslint/array-type": "off",
			// Unescaped entities is an HTML concern; React Native <Text> renders
			// quotes/apostrophes natively, so this rule is noise here.
			"react/no-unescaped-entities": "off",
			// React Compiler readiness rules — the backlog is cleared, so these are
			// enforced as errors now (rules-of-hooks is already an error in the preset).
			"react-hooks/set-state-in-effect": "error",
			"react-hooks/refs": "error",
			"react-hooks/immutability": "error",
			"react-hooks/exhaustive-deps": "error",
		},
	},
	{
		// Documentation coverage: every exported function/class/method/component
		// and exported interface/type carries a TSDoc block, so the 100% doc
		// baseline cannot silently regress.
		files: ["**/*.{ts,tsx}"],
		ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}", "test-support/**"],
		plugins: { jsdoc },
		rules: {
			"jsdoc/require-jsdoc": [
				"error",
				{
					publicOnly: true,
					require: {
						FunctionDeclaration: true,
						ClassDeclaration: true,
						MethodDefinition: true,
						ArrowFunctionExpression: true,
						FunctionExpression: true,
					},
					contexts: ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"],
				},
			],
		},
	},
	{
		// Test files use require() and interleave imports with jest.mock /
		// isolateModules loading, which the import-graph rules don't expect.
		files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
		rules: {
			"@typescript-eslint/no-require-imports": "off",
			"import/first": "off",
			// Inline mock components in tests don't need display names.
			"react/display-name": "off",
		},
	},
	{
		ignores: [
			"dist/*",
			".expo/*",
			"coverage/*",
			"docs/*",
			"android/*",
			"ios/*",
		],
	},
]);
