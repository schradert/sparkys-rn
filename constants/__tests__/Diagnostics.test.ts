/// <reference types="jest" />
import {
	DIAGNOSTICS_FOLDER_ID,
	DIAGNOSTICS_FOLDER_NAME,
	DIAGNOSTICS_LOGS_SUBFOLDER,
} from "@/constants/Diagnostics";

describe("diagnostics constants", () => {
	it("defaults the shared folder id to empty (personal-folder fallback)", () => {
		expect(DIAGNOSTICS_FOLDER_ID).toBe("");
	});

	it("names the diagnostics folder and logs subfolder", () => {
		expect(DIAGNOSTICS_FOLDER_NAME).toBe("Sparky's Diagnostics");
		expect(DIAGNOSTICS_LOGS_SUBFOLDER).toBe("Logs");
	});
});
