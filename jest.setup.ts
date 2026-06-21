/// <reference types="jest" />
// Test environment setup (runs after the framework is installed).
//
// The data layer (e.g. store/products) imports the structured logger, which
// starts a background flush timer backed by expo-file-system. In tests that
// timer leaks past teardown ("import after the Jest environment was torn
// down"), so stub the logger module everywhere. Logger behaviour itself is
// covered directly via services/logger/__tests__.
jest.mock("@/services/logger", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
	flushLogs: jest.fn(),
}));
