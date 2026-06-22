import { act, render, screen } from "@testing-library/react-native";
import Index from "@/app/index";

// The rendered-tree node type, derived from RNTL's `screen.root`.
type TestNode = NonNullable<typeof screen.root>;

/** Depth-first search for the first host node whose type matches `typeName`. */
function findByType(
	node: TestNode | null,
	typeName: string,
): TestNode | undefined {
	if (!node) {
		return undefined;
	}
	if (node.type === typeName) {
		return node;
	}
	for (const child of node.children) {
		if (typeof child === "string") {
			continue;
		}
		const found = findByType(child, typeName);
		if (found) {
			return found;
		}
	}
	return undefined;
}

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
	router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

let mockAuth: { isLoading: boolean; isSignedIn: boolean } = {
	isLoading: true,
	isSignedIn: false,
};
jest.mock("@/hooks/useAuth", () => ({
	useAuth: () => mockAuth,
}));

beforeEach(() => {
	jest.useFakeTimers();
	mockReplace.mockReset();
	mockAuth = { isLoading: true, isSignedIn: false };
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
});

describe("index", () => {
	it("shows a loading spinner", async () => {
		await render(<Index />);
		expect(findByType(screen.root, "ActivityIndicator")).toBeDefined();
	});

	it("does not navigate while auth is still loading", async () => {
		mockAuth = { isLoading: true, isSignedIn: false };
		await render(<Index />);
		await act(async () => {
			jest.advanceTimersByTime(100);
		});
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("redirects to /inventory when signed in", async () => {
		mockAuth = { isLoading: false, isSignedIn: true };
		await render(<Index />);
		await act(async () => {
			jest.advanceTimersByTime(100);
		});
		expect(mockReplace).toHaveBeenCalledWith("/inventory");
	});

	it("redirects to /login when not signed in", async () => {
		mockAuth = { isLoading: false, isSignedIn: false };
		await render(<Index />);
		await act(async () => {
			jest.advanceTimersByTime(100);
		});
		expect(mockReplace).toHaveBeenCalledWith("/login");
	});

	it("clears the pending timer on unmount without navigating", async () => {
		mockAuth = { isLoading: false, isSignedIn: true };
		const view = await render(<Index />);
		// Unmount before the 100ms timer elapses; the effect cleanup must clear it.
		await act(async () => {
			view.unmount();
		});
		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		expect(mockReplace).not.toHaveBeenCalled();
	});
});
