/// <reference types="jest" />
import {
	appendLines,
	isAvailable,
	listSegmentInfo,
	readAllSegments,
	readMarker,
	writeMarker,
} from "@/services/logger/fileSink.web";

describe("fileSink.web (in-memory stub)", () => {
	it("appendLines and writeMarker are no-ops that return undefined", () => {
		expect(appendLines(["a", "b"])).toBeUndefined();
		expect(writeMarker("{}")).toBeUndefined();
	});

	it("readAllSegments resolves to an empty string", async () => {
		await expect(readAllSegments()).resolves.toBe("");
	});

	it("listSegmentInfo returns an empty array", () => {
		expect(listSegmentInfo()).toEqual([]);
	});

	it("readMarker returns null", () => {
		expect(readMarker()).toBeNull();
	});

	it("isAvailable reports false on web", () => {
		expect(isAvailable()).toBe(false);
	});
});
