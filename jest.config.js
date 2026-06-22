/** @type {import('jest').Config} */
module.exports = {
	// jest-expo's preset already provides the correct transform +
	// transformIgnorePatterns (covering expo-modules-core, react-native, etc.).
	// We only add the project's "@/" path alias.
	preset: "jest-expo",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
	collectCoverageFrom: [
		"app/**/*.{ts,tsx}",
		"components/**/*.{ts,tsx}",
		"constants/**/*.{ts,tsx}",
		"hooks/**/*.{ts,tsx}",
		"services/**/*.{ts,tsx}",
		"store/**/*.{ts,tsx}",
		"!**/*.d.ts",
		"!**/__tests__/**",
	],
	coveragePathIgnorePatterns: ["/node_modules/", "/.expo/", "/coverage/"],
	// Coverage ratchet: a floor set just under current coverage. Raise these as
	// tests are added so coverage can only go up. See CONTRIBUTING.md.
	coverageThreshold: {
		global: { statements: 100, branches: 100, functions: 100, lines: 100 },
	},
};
