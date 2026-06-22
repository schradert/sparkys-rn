import { fireEvent, render, screen } from "@testing-library/react-native";
import AvatarDropdown from "@/components/AvatarDropdown";
import { logger } from "@/services/logger";

// The rendered-tree node type, derived from RNTL's `screen.root` so no extra
// type dependency is needed.
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

// --- Mock surface -----------------------------------------------------------
// expo-router's `router` is the navigation side effect for each menu item.
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
	router: {
		replace: (...args: unknown[]) => mockReplace(...args),
		push: (...args: unknown[]) => mockPush(...args),
	},
}));

// `useAuth` supplies the user (drives the avatar branch) and `signOut`.
const mockSignOut = jest.fn();
let mockUser: { user?: { photo?: string | null } } | null = null;
jest.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({ user: mockUser, signOut: mockSignOut }),
}));

// `useTheme` supplies the current theme + the toggle action.
const mockToggleTheme = jest.fn();
let mockTheme: "light" | "dark" = "light";
jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: mockTheme, toggleTheme: mockToggleTheme }),
}));

// Render each Ionicon as its glyph name so icons are queryable by text. The
// avatar button has no label/testID in the source (which tests must not edit),
// so its child `person` icon is the stable handle for opening the menu; press
// events bubble from the icon to the parent Pressable.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native") as typeof import("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
	};
});

/** Open the dropdown via the default-avatar `person` icon. */
async function openMenu() {
	await fireEvent.press(screen.getByText("icon:person"));
}

beforeEach(() => {
	mockReplace.mockReset();
	mockPush.mockReset();
	mockSignOut.mockReset().mockResolvedValue(undefined);
	mockToggleTheme.mockReset();
	mockUser = null;
	mockTheme = "light";
	(logger.debug as jest.Mock).mockClear();
	(logger.info as jest.Mock).mockClear();
});

describe("AvatarDropdown", () => {
	it("renders the default avatar when the user has no photo", async () => {
		mockUser = { user: { photo: null } };
		await render(<AvatarDropdown />);
		expect(screen.getByText("icon:person")).toBeOnTheScreen();
		// The dropdown is closed initially, so no menu item is shown.
		expect(screen.queryByText("Sign Out")).toBeNull();
	});

	it("renders the user's photo when present", async () => {
		mockUser = { user: { photo: "https://example.com/a.png" } };
		await render(<AvatarDropdown />);
		// The photo branch wires an Image to the user's photo URI; locate it by
		// walking the rendered tree (the source has no testID to query by).
		const image = findByType(screen.root, "Image");
		expect(image?.props.source).toEqual({ uri: "https://example.com/a.png" });
		// No default-avatar icon is rendered in the photo branch.
		expect(screen.queryByText("icon:person")).toBeNull();
	});

	it("opens and closes the dropdown when the avatar is pressed", async () => {
		await render(<AvatarDropdown />);
		await openMenu();
		expect(screen.getByText("Sign Out")).toBeOnTheScreen();

		// Pressing again toggles it back closed.
		await openMenu();
		expect(screen.queryByText("Sign Out")).toBeNull();
	});

	it("shows the 'Dark' label and moon icon in the light theme", async () => {
		mockTheme = "light";
		await render(<AvatarDropdown />);
		await openMenu();
		expect(screen.getByText("Dark")).toBeOnTheScreen();
		expect(screen.getByText("icon:moon-outline")).toBeOnTheScreen();
	});

	it("shows the 'Light' label and sun icon in the dark theme", async () => {
		mockTheme = "dark";
		await render(<AvatarDropdown />);
		await openMenu();
		expect(screen.getByText("Light")).toBeOnTheScreen();
		expect(screen.getByText("icon:sunny-outline")).toBeOnTheScreen();
	});

	it("toggles the theme and closes the dropdown", async () => {
		await render(<AvatarDropdown />);
		await openMenu();

		await fireEvent.press(screen.getByText("Dark"));
		expect(mockToggleTheme).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("Sign Out")).toBeNull();
	});

	it("navigates to /activity and closes the dropdown", async () => {
		await render(<AvatarDropdown />);
		await openMenu();

		await fireEvent.press(screen.getByText("Activity"));
		expect(mockPush).toHaveBeenCalledWith("/activity");
		expect(screen.queryByText("Sign Out")).toBeNull();
	});

	it("navigates to /diagnostics and closes the dropdown", async () => {
		await render(<AvatarDropdown />);
		await openMenu();

		await fireEvent.press(screen.getByText("Share diagnostics"));
		expect(mockPush).toHaveBeenCalledWith("/diagnostics");
		expect(screen.queryByText("Sign Out")).toBeNull();
	});

	it("signs out and redirects to /login on success", async () => {
		await render(<AvatarDropdown />);
		await openMenu();

		await fireEvent.press(screen.getByText("Sign Out"));
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(mockReplace).toHaveBeenCalledWith("/login");
		expect(logger.info).toHaveBeenCalledWith("Auth", "Sign out completed");
		// The dropdown closes as part of the handler.
		expect(screen.queryByText("Sign Out")).toBeNull();
	});

	it("logs and does not redirect when sign out fails", async () => {
		const err = new Error("nope");
		mockSignOut.mockRejectedValue(err);
		await render(<AvatarDropdown />);
		await openMenu();

		await fireEvent.press(screen.getByText("Sign Out"));
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(mockReplace).not.toHaveBeenCalled();
		expect(logger.debug).toHaveBeenCalledWith("Auth", "Sign out error", {
			error: err,
		});
	});
});
