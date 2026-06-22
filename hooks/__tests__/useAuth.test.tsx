import { logger } from "@/services/logger";

// --- Mock surface -----------------------------------------------------------
// `useAuth` runs `GoogleSignin.configure()` and `initializeAuth()` at module
// load, so the mocks must exist before the module is (re)required. Each helper
// is a jest.fn we can re-point per test; `isSuccessResponse` is a standalone
// named export used to branch on the sign-in result.
const mockConfigure = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockHasPlayServices = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetTokens = jest.fn();
const mockAddScopes = jest.fn();
const mockClearCachedAccessToken = jest.fn();
const mockIsSuccessResponse = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
	GoogleSignin: {
		configure: (...args: unknown[]) => mockConfigure(...args),
		getCurrentUser: () => mockGetCurrentUser(),
		hasPlayServices: () => mockHasPlayServices(),
		signIn: () => mockSignIn(),
		signOut: () => mockSignOut(),
		getTokens: () => mockGetTokens(),
		addScopes: (...args: unknown[]) => mockAddScopes(...args),
		clearCachedAccessToken: (...args: unknown[]) =>
			mockClearCachedAccessToken(...args),
	},
	isSuccessResponse: (r: unknown) => mockIsSuccessResponse(r),
}));

// Platform.OS is read inside getDriveAccessToken; make it mutable per test.
const platform = { OS: "ios" as "ios" | "android" };
jest.mock("react-native", () => ({
	get Platform() {
		return platform;
	},
}));

type AuthModule = typeof import("@/hooks/useAuth");
type AuthApi = ReturnType<AuthModule["useAuth"]>;
// The `pure` entry exposes `renderHook`/`act` *without* registering RNTL's
// auto-cleanup `afterEach`/`afterAll` (which throw when required inside a test).
type RNTLPure = typeof import("@testing-library/react-native/pure");

/**
 * Re-require the hook in a fresh module registry so the load-time
 * `initializeAuth()` re-runs and the singleton auth state resets per test.
 * RNTL and React are required inside the *same* isolated scope so the renderer
 * and the hook share one React instance (otherwise hooks dispatch against a
 * null dispatcher). Returns the fresh module plus that scope's `renderHook`/
 * `act` so callers drive updates through the matching renderer.
 */
function loadIsolated(): { mod: AuthModule; rntl: RNTLPure } {
	let mod: AuthModule;
	let rntl: RNTLPure;
	jest.isolateModules(() => {
		rntl = require("@testing-library/react-native/pure") as RNTLPure;
		mod = require("@/hooks/useAuth") as AuthModule;
	});
	// biome-ignore lint/style/noNonNullAssertion: isolateModules runs synchronously
	return { mod: mod!, rntl: rntl! };
}

/** Load the module only (for assertions that don't render the hook). */
function loadModule(): AuthModule {
	return loadIsolated().mod;
}

/**
 * `signIn`/`signOut`/`getAccessToken` are not module exports — they're only
 * reachable via the hook's return value. This renders the hook once and hands
 * back the live `result`, the matching `act`, and an `unmount`.
 */
async function loadHook(): Promise<{
	mod: AuthModule;
	result: { current: AuthApi };
	act: RNTLPure["act"];
	unmount: () => Promise<void>;
}> {
	const { mod, rntl } = loadIsolated();
	const { result, unmount } = await rntl.renderHook(() => mod.useAuth());
	return { mod, result, act: rntl.act, unmount };
}

const fakeUser = { user: { id: "u1", email: "a@b.com" } };

beforeEach(() => {
	platform.OS = "ios";
	mockConfigure.mockClear();
	mockGetCurrentUser.mockReset();
	mockHasPlayServices.mockReset().mockResolvedValue(true);
	mockSignIn.mockReset();
	mockSignOut.mockReset().mockResolvedValue(undefined);
	mockGetTokens.mockReset();
	mockAddScopes.mockReset().mockResolvedValue(undefined);
	mockClearCachedAccessToken.mockReset().mockResolvedValue(undefined);
	mockIsSuccessResponse.mockReset();
	(logger.error as jest.Mock).mockClear();
	(logger.warn as jest.Mock).mockClear();
});

describe("module initialization", () => {
	it("configures GoogleSignin on load", () => {
		mockGetCurrentUser.mockReturnValue(null);
		loadModule();
		expect(mockConfigure).toHaveBeenCalledTimes(1);
		expect(mockConfigure).toHaveBeenCalledWith(
			expect.objectContaining({
				iosClientId: expect.any(String),
				scopes: expect.arrayContaining([
					"https://www.googleapis.com/auth/spreadsheets",
				]),
			}),
		);
	});

	it("seeds a signed-in state when a current user exists", async () => {
		mockGetCurrentUser.mockReturnValue(fakeUser);
		const { result } = await loadHook();
		expect(result.current.isSignedIn).toBe(true);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.user).toBe(fakeUser);
	});

	it("seeds a signed-out state when no current user exists", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result } = await loadHook();
		expect(result.current.isSignedIn).toBe(false);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.user).toBeNull();
	});
});

describe("useAuth subscription", () => {
	it("re-renders subscribers on state change and unsubscribes on unmount", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result, act, unmount } = await loadHook();

		mockIsSuccessResponse.mockReturnValue(true);
		mockSignIn.mockResolvedValue({ data: fakeUser });

		await act(async () => {
			await result.current.signIn();
		});
		// The forceUpdate subscriber fired, so the hook now reflects new state.
		expect(result.current.isSignedIn).toBe(true);

		await unmount();
		// After unmounting, a further state change must not throw (no stale sub).
		await act(async () => {
			await result.current.signOut();
		});
		expect(result.current.isSignedIn).toBe(true); // stale snapshot, no re-render
	});
});

describe("signIn", () => {
	it("returns success and stores the user on a success response", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result, act } = await loadHook();

		mockIsSuccessResponse.mockReturnValue(true);
		mockSignIn.mockResolvedValue({ data: fakeUser });

		let outcome: Awaited<ReturnType<AuthApi["signIn"]>> | undefined;
		await act(async () => {
			outcome = await result.current.signIn();
		});

		expect(outcome).toEqual({ success: true });
		expect(mockHasPlayServices).toHaveBeenCalledTimes(1);
		expect(result.current.user).toBe(fakeUser);
		expect(result.current.isSignedIn).toBe(true);
		expect(result.current.isLoading).toBe(false);
	});

	it("returns failure without error on a cancelled (non-success) response", async () => {
		mockGetCurrentUser.mockReturnValue(fakeUser);
		const { result, act } = await loadHook();

		mockIsSuccessResponse.mockReturnValue(false);
		mockSignIn.mockResolvedValue({ type: "cancelled" });

		let outcome: Awaited<ReturnType<AuthApi["signIn"]>> | undefined;
		await act(async () => {
			outcome = await result.current.signIn();
		});

		expect(outcome).toEqual({ success: false });
		expect(result.current.isSignedIn).toBe(false);
		expect(result.current.user).toBeNull();
	});

	it("returns the error message when sign-in throws an Error", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result, act } = await loadHook();

		mockSignIn.mockRejectedValue(new Error("boom"));

		let outcome: Awaited<ReturnType<AuthApi["signIn"]>> | undefined;
		await act(async () => {
			outcome = await result.current.signIn();
		});

		expect(outcome).toEqual({ success: false, error: "boom" });
		expect(result.current.isSignedIn).toBe(false);
	});

	it("falls back to a default message when the error has none", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result, act } = await loadHook();

		// getErrorMessage("") -> "" (falsy) -> exercises the `|| "Sign in failed"`.
		mockSignIn.mockRejectedValue("");

		let outcome: Awaited<ReturnType<AuthApi["signIn"]>> | undefined;
		await act(async () => {
			outcome = await result.current.signIn();
		});

		expect(outcome).toEqual({ success: false, error: "Sign in failed" });
	});
});

describe("signOut", () => {
	it("clears state on success", async () => {
		mockGetCurrentUser.mockReturnValue(fakeUser);
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.signOut();
		});

		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(result.current.isSignedIn).toBe(false);
		expect(result.current.user).toBeNull();
	});

	it("logs and swallows errors", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result } = await loadHook();

		const err = new Error("signout failed");
		mockSignOut.mockRejectedValue(err);

		await expect(result.current.signOut()).resolves.toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith("Auth", "Sign out error", {
			error: err,
		});
	});
});

describe("getAccessToken", () => {
	it("resolves the access token", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result } = await loadHook();
		mockGetTokens.mockResolvedValue({ accessToken: "tok-123" });

		await expect(result.current.getAccessToken()).resolves.toBe("tok-123");
	});

	it("deduplicates concurrent calls behind one in-flight promise", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result } = await loadHook();

		let resolveTokens: (v: { accessToken: string }) => void = () => {};
		mockGetTokens.mockReturnValue(
			new Promise((res) => {
				resolveTokens = res;
			}),
		);

		const p1 = result.current.getAccessToken();
		// Second call hits the `if (tokenPromise) return tokenPromise` guard.
		const p2 = result.current.getAccessToken();
		resolveTokens({ accessToken: "shared" });

		await expect(p1).resolves.toBe("shared");
		await expect(p2).resolves.toBe("shared");
		expect(mockGetTokens).toHaveBeenCalledTimes(1);
	});

	it("returns null and logs when token retrieval throws", async () => {
		mockGetCurrentUser.mockReturnValue(null);
		const { result } = await loadHook();
		const err = new Error("no token");
		mockGetTokens.mockRejectedValue(err);

		await expect(result.current.getAccessToken()).resolves.toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"Auth",
			"Get access token error",
			{ error: err },
		);
	});
});

describe("getDriveAccessToken", () => {
	it("requests the Drive scope and returns the refreshed token on iOS", async () => {
		platform.OS = "ios";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		mockGetTokens.mockResolvedValue({ accessToken: "drive-tok" });

		await expect(mod.getDriveAccessToken()).resolves.toBe("drive-tok");
		expect(mockAddScopes).toHaveBeenCalledWith({
			scopes: ["https://www.googleapis.com/auth/drive"],
		});
		// iOS must not clear a cached token.
		expect(mockClearCachedAccessToken).not.toHaveBeenCalled();
	});

	it("warns but proceeds when addScopes fails", async () => {
		platform.OS = "ios";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		mockAddScopes.mockRejectedValue(new Error("scope denied"));
		mockGetTokens.mockResolvedValue({ accessToken: "still-works" });

		await expect(mod.getDriveAccessToken()).resolves.toBe("still-works");
		expect(logger.warn).toHaveBeenCalledWith(
			"Auth",
			"addScopes(drive) failed; trying existing token",
			expect.objectContaining({ error: expect.any(Error) }),
		);
	});

	it("clears the cached token before refreshing on Android", async () => {
		platform.OS = "android";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		mockGetTokens
			.mockResolvedValueOnce({ accessToken: "old-tok" })
			.mockResolvedValueOnce({ accessToken: "new-tok" });

		await expect(mod.getDriveAccessToken()).resolves.toBe("new-tok");
		expect(mockClearCachedAccessToken).toHaveBeenCalledWith("old-tok");
		expect(mockGetTokens).toHaveBeenCalledTimes(2);
	});

	it("skips clearing when the current Android token has no accessToken", async () => {
		platform.OS = "android";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		mockGetTokens
			.mockResolvedValueOnce({ accessToken: undefined })
			.mockResolvedValueOnce({ accessToken: "fresh" });

		await expect(mod.getDriveAccessToken()).resolves.toBe("fresh");
		expect(mockClearCachedAccessToken).not.toHaveBeenCalled();
	});

	it("falls through when the pre-clear getTokens throws on Android", async () => {
		platform.OS = "android";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		mockGetTokens
			.mockRejectedValueOnce(new Error("transient"))
			.mockResolvedValueOnce({ accessToken: "recovered" });

		await expect(mod.getDriveAccessToken()).resolves.toBe("recovered");
		expect(mockClearCachedAccessToken).not.toHaveBeenCalled();
		expect(mockGetTokens).toHaveBeenCalledTimes(2);
	});

	it("coerces a missing accessToken to null", async () => {
		platform.OS = "ios";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		mockGetTokens.mockResolvedValue({ accessToken: undefined });

		await expect(mod.getDriveAccessToken()).resolves.toBeNull();
	});

	it("returns null and logs when the final getTokens throws", async () => {
		platform.OS = "ios";
		mockGetCurrentUser.mockReturnValue(null);
		const mod = loadModule();
		const err = new Error("final fail");
		mockGetTokens.mockRejectedValue(err);

		await expect(mod.getDriveAccessToken()).resolves.toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"Auth",
			"Failed to obtain Drive access token",
			{ error: err },
		);
	});
});
