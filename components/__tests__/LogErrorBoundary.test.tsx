import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { LogErrorBoundary } from "@/components/LogErrorBoundary";
import { flushLogs, logger } from "@/services/logger";

// `useTheme` requires a ThemeProvider at runtime; mock it so the fallback can
// resolve a palette in isolation. `@/services/logger` is globally mocked in
// jest.setup.ts, so the mocked fns are imported here to assert against.
jest.mock("@/hooks/useTheme", () => ({
	useTheme: jest.fn(() => ({ theme: "light", toggleTheme: jest.fn() })),
}));

function Boom({ message }: { message?: string }): React.ReactElement {
	throw new Error(message ?? "kaboom");
}

describe("LogErrorBoundary", () => {
	let consoleError: jest.SpyInstance;

	beforeEach(() => {
		// React logs caught render errors to console.error; silence it so the test
		// output stays clean, then restore afterwards.
		consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleError.mockRestore();
		jest.clearAllMocks();
	});

	it("renders children when nothing throws", async () => {
		await render(
			<LogErrorBoundary>
				<Text>Safe content</Text>
			</LogErrorBoundary>,
		);
		expect(screen.getByText("Safe content")).toBeOnTheScreen();
	});

	it("renders the fallback and logs when a child throws", async () => {
		await render(
			<LogErrorBoundary>
				<Boom message="render exploded" />
			</LogErrorBoundary>,
		);

		expect(screen.getByText("Something went wrong")).toBeOnTheScreen();
		expect(screen.getByText("render exploded")).toBeOnTheScreen();
		expect(screen.getByText("Try again")).toBeOnTheScreen();
		expect(logger.error).toHaveBeenCalledWith(
			"react",
			"render exploded",
			expect.objectContaining({ error: expect.any(Error) }),
		);
		expect(flushLogs).toHaveBeenCalledTimes(1);
	});

	it("falls back to a default message when the error has none", async () => {
		await render(
			<LogErrorBoundary>
				<Boom message="" />
			</LogErrorBoundary>,
		);
		expect(screen.getByText("An unexpected error occurred.")).toBeOnTheScreen();
	});

	it("clears the error and re-renders children after Try again", async () => {
		// A child that throws once, then renders cleanly after reset re-mounts it.
		function Flaky() {
			const [crashed] = useState(true);
			if (crashed) {
				throw new Error("first render fails");
			}
			return <Text>recovered</Text>;
		}

		// Toggle the child via an outer control so the post-reset render succeeds.
		function Harness() {
			const [ok, setOk] = useState(false);
			return (
				<>
					<Pressable onPress={() => setOk(true)}>
						<Text>flip</Text>
					</Pressable>
					<LogErrorBoundary>
						{ok ? <Text>recovered</Text> : <Flaky />}
					</LogErrorBoundary>
				</>
			);
		}

		await render(<Harness />);
		expect(screen.getByText("Something went wrong")).toBeOnTheScreen();

		// Make the next child render succeed, then reset the boundary.
		await fireEvent.press(screen.getByText("flip"));
		await fireEvent.press(screen.getByText("Try again"));

		expect(screen.getByText("recovered")).toBeOnTheScreen();
		expect(screen.queryByText("Something went wrong")).not.toBeOnTheScreen();
	});
});
