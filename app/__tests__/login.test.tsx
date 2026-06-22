import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import Login from "@/app/login";

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

const mockSignIn = jest.fn();
let mockIsLoading = false;
jest.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({ signIn: mockSignIn, isLoading: mockIsLoading }),
}));

beforeEach(() => {
	mockReplace.mockReset();
	mockSignIn.mockReset();
	mockIsLoading = false;
	jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("login", () => {
	it("renders a loading state while auth initializes", async () => {
		mockIsLoading = true;
		await render(<Login />);
		expect(screen.getByText("Loading...")).toBeOnTheScreen();
		expect(findByType(screen.root, "ActivityIndicator")).toBeDefined();
		// The sign-in button is not rendered in the loading branch.
		expect(screen.queryByText("Sign in with Google")).toBeNull();
	});

	it("renders the sign-in screen when not loading", async () => {
		await render(<Login />);
		expect(screen.getByText("Sparky's Inventory")).toBeOnTheScreen();
		expect(screen.getByText("Sign in with Google")).toBeOnTheScreen();
	});

	it("signs in and redirects to /inventory on success", async () => {
		mockSignIn.mockResolvedValue({ success: true });
		await render(<Login />);

		await fireEvent.press(screen.getByText("Sign in with Google"));

		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/inventory"));
		expect(mockSignIn).toHaveBeenCalledTimes(1);
		expect(Alert.alert).not.toHaveBeenCalled();
	});

	it("alerts with the returned error when sign-in fails", async () => {
		mockSignIn.mockResolvedValue({ success: false, error: "Bad creds" });
		await render(<Login />);

		await fireEvent.press(screen.getByText("Sign in with Google"));

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith("Sign In Failed", "Bad creds"),
		);
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("falls back to a generic message when failure has no error", async () => {
		mockSignIn.mockResolvedValue({ success: false });
		await render(<Login />);

		await fireEvent.press(screen.getByText("Sign in with Google"));

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith(
				"Sign In Failed",
				"Something went wrong",
			),
		);
	});

	it("shows an in-button spinner while signing in", async () => {
		// Hold the promise open so the `isSigningIn` branch stays rendered. The
		// press is intentionally not awaited here: awaiting it would block on this
		// still-pending sign-in promise.
		let resolveSignIn: (r: { success: boolean }) => void = () => {};
		mockSignIn.mockReturnValue(
			new Promise((resolve) => {
				resolveSignIn = resolve;
			}),
		);
		await render(<Login />);

		const press = fireEvent.press(screen.getByText("Sign in with Google"));

		// While in flight the label is swapped for a spinner.
		await waitFor(() =>
			expect(screen.queryByText("Sign in with Google")).toBeNull(),
		);
		expect(findByType(screen.root, "ActivityIndicator")).toBeDefined();

		await act(async () => {
			resolveSignIn({ success: true });
			await press;
		});
		await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/inventory"));
	});
});
