/// <reference types="jest" />
// The public barrel just re-exports the logger surface + types. jest.setup.ts
// globally mocks "@/services/logger", so to evaluate (and cover) the real
// barrel we pull it in with requireActual. The disk sink is stubbed so the real
// logger it re-exports can't touch native FS or leak a flush timer.
jest.mock("@/services/logger/fileSink", () => ({
	appendLines: jest.fn(),
}));

type Barrel = typeof import("@/services/logger");
type LoggerModule = typeof import("@/services/logger/logger");

const publicApi = jest.requireActual<Barrel>("@/services/logger");
const concrete = jest.requireActual<LoggerModule>("@/services/logger/logger");

describe("services/logger public barrel", () => {
	it("re-exports the logger value API", () => {
		expect(typeof publicApi.logger).toBe("object");
		expect(typeof publicApi.logger.info).toBe("function");
		expect(typeof publicApi.flushLogs).toBe("function");
		expect(typeof publicApi.getLogEntries).toBe("function");
		expect(typeof publicApi.getMinLevel).toBe("function");
		expect(typeof publicApi.setMinLevel).toBe("function");
		expect(typeof publicApi.getSessionId).toBe("function");
		expect(typeof publicApi.subscribeToLogs).toBe("function");
	});

	it("re-exports the same logger instance as the concrete module", () => {
		expect(publicApi.logger).toBe(concrete.logger);
		expect(publicApi.getSessionId()).toBe(concrete.getSessionId());
	});
});
