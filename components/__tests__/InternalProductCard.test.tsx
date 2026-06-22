import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import InternalProductCard from "@/components/InternalProductCard";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

// Render icons as plain text of their `name` so glyphs are queryable.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
	};
});

function makeInternal(
	overrides: Partial<InternalProduct> = {},
): InternalProduct {
	return {
		id: "int-1",
		sparkys_product_name: "Red Round Latex",
		product_type: "Latex Balloons",
		sparkys_color: "Red",
		texture: "Matte",
		shape: "Round",
		occasions: ["Birthday"],
		products: ["SKU-A"],
		threshold_quantity: 10,
		never_out: false,
		status: "active",
		...overrides,
	};
}

function makeExternal(
	overrides: Partial<ExternalProduct> = {},
): ExternalProduct {
	return {
		unique_id_sku: "SKU-A",
		manufacturer_color: "Flaming Red",
		brand: "Qualatex",
		size: '11"',
		bag_quantity: 100,
		distributors: ["Default Distributor"],
		quantity: 5,
		status: "active",
		...overrides,
	};
}

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: 1,
		timestamp: "2026-01-01T00:00:00.000Z",
		event_type: "quantity_update",
		object_type: "external_product",
		object_id: "SKU-A",
		object_name: "SKU-A",
		changes: "{}",
		before_state: "{}",
		sheet_name: "external",
		user_email: "t@example.com",
		...overrides,
	};
}

describe("InternalProductCard", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("enables the LayoutAnimation experimental flag on Android at import time", () => {
		// The module-level guard only runs when Platform.OS is "android" and the
		// experimental setter exists. Re-import the module in an isolated registry
		// with those conditions set on the same react-native instance the module
		// will resolve.
		const setter = jest.fn();
		jest.isolateModules(() => {
			const RN = require("react-native");
			Object.defineProperty(RN.Platform, "OS", {
				configurable: true,
				value: "android",
			});
			RN.UIManager.setLayoutAnimationEnabledExperimental = setter;
			require("@/components/InternalProductCard");
		});
		expect(setter).toHaveBeenCalledWith(true);
	});

	it("renders the name, metadata, occasions, and external-count summary", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
			/>,
		);
		expect(screen.getByText("Red Round Latex")).toBeOnTheScreen();
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
		expect(screen.getByText("Matte")).toBeOnTheScreen();
		expect(screen.getByText("Round")).toBeOnTheScreen();
		expect(screen.getByText("Red")).toBeOnTheScreen();
		expect(screen.getByText("Birthday")).toBeOnTheScreen();
		expect(screen.getByText("1 external product")).toBeOnTheScreen();
	});

	it("navigates to the internal product detail on header press", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ id: "int 1/x" })}
				externalProducts={[makeExternal()]}
			/>,
		);
		await fireEvent.press(screen.getByText("Red Round Latex"));
		expect(router.push).toHaveBeenCalledWith("/internal-product/int%201%2Fx");
	});

	it("pluralizes the external-product count for zero or many", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: ["SKU-A", "SKU-B"] })}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A" }),
					makeExternal({ unique_id_sku: "SKU-B" }),
				]}
			/>,
		);
		expect(screen.getByText("2 external products")).toBeOnTheScreen();
	});

	it("renders the Never Out badge when never_out is true", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ never_out: true })}
				externalProducts={[makeExternal()]}
			/>,
		);
		expect(screen.getByText("Never Out")).toBeOnTheScreen();
	});

	it("omits metadata fields that are empty or whitespace-only", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({
					product_type: "",
					texture: "   ",
					shape: "Heart",
					sparkys_color: "Blue",
				})}
				externalProducts={[makeExternal()]}
			/>,
		);
		expect(screen.getByText("Heart")).toBeOnTheScreen();
		expect(screen.getByText("Blue")).toBeOnTheScreen();
		expect(screen.queryByText("Latex Balloons")).toBeNull();
	});

	it("does not render the occasions section when occasions is empty", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ occasions: [] })}
				externalProducts={[makeExternal()]}
			/>,
		);
		expect(screen.queryByText("Birthday")).toBeNull();
	});

	it("does not render the occasions section when occasions is missing", async () => {
		const internal = makeInternal();
		(internal as { occasions?: string[] }).occasions = undefined;
		await render(
			<InternalProductCard
				internalProduct={internal}
				externalProducts={[makeExternal()]}
			/>,
		);
		expect(screen.queryByText("Birthday")).toBeNull();
	});

	it("shows the archived label and uses the 0 threshold fallback", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({
					status: "archived",
					threshold_quantity: undefined as unknown as number,
				})}
				externalProducts={[makeExternal({ quantity: 7 })]}
			/>,
		);
		expect(screen.getByText("(Archived)")).toBeOnTheScreen();
		// totalQuantity 7 with the `?? 0` threshold fallback -> "7 / 0".
		expect(screen.getByText("7")).toBeOnTheScreen();
		expect(screen.getByText("/ 0")).toBeOnTheScreen();
	});

	it("uses the red quantity color when total is below threshold", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ threshold_quantity: 10 })}
				externalProducts={[makeExternal({ quantity: 4 })]}
			/>,
		);
		expect(screen.getByText("4")).toBeOnTheScreen();
		expect(screen.getByText("/ 10")).toBeOnTheScreen();
	});

	it("uses the blue quantity color in the at-threshold band", async () => {
		// 10 <= 11 <= 12.5 -> blue (default branch of getQuantityColorValue).
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ threshold_quantity: 10 })}
				externalProducts={[makeExternal({ quantity: 11 })]}
			/>,
		);
		expect(screen.getByText("11")).toBeOnTheScreen();
	});

	it("uses the green quantity color when comfortably above threshold", async () => {
		// 20 > 10 * 1.25 -> green.
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ threshold_quantity: 10 })}
				externalProducts={[makeExternal({ quantity: 20 })]}
			/>,
		);
		expect(screen.getByText("20")).toBeOnTheScreen();
	});

	it("excludes archived externals from the total quantity", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: ["SKU-A", "SKU-B"] })}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A", quantity: 5 }),
					makeExternal({
						unique_id_sku: "SKU-B",
						quantity: 100,
						status: "archived",
					}),
				]}
			/>,
		);
		// Only the active SKU-A counts toward the total.
		expect(screen.getByText("5")).toBeOnTheScreen();
	});

	it("invokes onMetadataPress for metadata and occasion pills", async () => {
		const onMetadataPress = jest.fn();
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
				onMetadataPress={onMetadataPress}
			/>,
		);
		await fireEvent.press(screen.getByText("Latex Balloons"));
		expect(onMetadataPress).toHaveBeenCalledWith(
			"product_type",
			"Latex Balloons",
		);
		await fireEvent.press(screen.getByText("Birthday"));
		expect(onMetadataPress).toHaveBeenCalledWith("occasions", "Birthday");
	});

	it("does not throw when pills are pressed without onMetadataPress", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
			/>,
		);
		await fireEvent.press(screen.getByText("Latex Balloons"));
		await fireEvent.press(screen.getByText("Birthday"));
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
	});

	it("highlights selected metadata and occasion pills via selectedFilters", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
				selectedFilters={{
					internal: {
						product_type: ["Latex Balloons"],
						occasions: ["Birthday"],
					},
				}}
			/>,
		);
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
		expect(screen.getByText("Birthday")).toBeOnTheScreen();
	});

	it("treats a field with no matching internal filter list as unselected", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
				selectedFilters={{ internal: { texture: ["Pearl"] } }}
			/>,
		);
		// product_type has no filter list here -> the `? :` false branch.
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
	});

	it("treats all pills as unselected when selectedFilters.internal is absent", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
				selectedFilters={{}}
			/>,
		);
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
	});

	it("expands to show the related external product card", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal()]}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		// The nested ExternalProductCard renders the SKU.
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		// Toggling again collapses it.
		await fireEvent.press(screen.getByText("chevron-up"));
		expect(screen.queryByText("SKU-A")).toBeNull();
	});

	it("shows the empty state when expanded with no related externals", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: ["SKU-MISSING"] })}
				externalProducts={[makeExternal({ unique_id_sku: "SKU-A" })]}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(
			screen.getByText(
				"No external products assigned to this internal product yet",
			),
		).toBeOnTheScreen();
	});

	it("includes archived externals when showArchived is true", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: ["SKU-A", "SKU-B"] })}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A", quantity: 5 }),
					makeExternal({
						unique_id_sku: "SKU-B",
						quantity: 3,
						status: "archived",
					}),
				]}
				selectedFilters={{ external: { showArchived: true } }}
			/>,
		);
		// Count includes the archived external when showArchived is on.
		expect(screen.getByText("2 external products")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		// The archived external's SKU renders alongside an "(Archived)" label.
		expect(screen.getByText(/SKU-B/)).toBeOnTheScreen();
		expect(screen.getByText("(Archived)")).toBeOnTheScreen();
	});

	it("applies the explicit showArchived=false display filter branch", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal({ unique_id_sku: "SKU-A" })]}
				selectedFilters={{ external: { showArchived: false } }}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
	});

	it("filters displayed externals by a distributors selection", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: ["SKU-A", "SKU-B"] })}
				externalProducts={[
					makeExternal({
						unique_id_sku: "SKU-A",
						distributors: ["Dist X"],
					}),
					makeExternal({
						unique_id_sku: "SKU-B",
						distributors: ["Dist Y"],
					}),
				]}
				selectedFilters={{ external: { distributors: ["Dist X"] } }}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		expect(screen.queryByText("SKU-B")).toBeNull();
	});

	it("filters displayed externals by a scalar field selection", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: ["SKU-A", "SKU-B"] })}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A", size: '11"' }),
					makeExternal({ unique_id_sku: "SKU-B", size: '16"' }),
				]}
				selectedFilters={{ external: { size: ['11"'] } }}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		expect(screen.queryByText("SKU-B")).toBeNull();
	});

	it("ignores empty filter arrays in the display filter", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[makeExternal({ unique_id_sku: "SKU-A" })]}
				selectedFilters={{ external: { size: [] } }}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		// An empty selection list does not filter anything out.
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
	});

	it("sorts externals by event frequency, then recency, then reverse alphabetical", async () => {
		const internal = makeInternal({
			products: ["SKU-A", "SKU-B", "SKU-C", "SKU-D"],
		});
		const externals = [
			makeExternal({ unique_id_sku: "SKU-A" }), // 1 event, recent
			makeExternal({ unique_id_sku: "SKU-B" }), // 2 events -> most frequent
			makeExternal({ unique_id_sku: "SKU-C" }), // 1 event, older
			makeExternal({ unique_id_sku: "SKU-D" }), // 0 events
		];
		const events: AuditEvent[] = [
			makeEvent({
				id: 10,
				object_id: "SKU-B",
				timestamp: "2026-03-01T00:00:00Z",
			}),
			makeEvent({
				id: 9,
				object_id: "SKU-B",
				timestamp: "2026-02-01T00:00:00Z",
			}),
			makeEvent({
				id: 8,
				object_id: "SKU-A",
				timestamp: "2026-05-01T00:00:00Z",
			}),
			makeEvent({
				id: 7,
				object_id: "SKU-C",
				timestamp: "2026-01-01T00:00:00Z",
			}),
		];
		await render(
			<InternalProductCard
				internalProduct={internal}
				externalProducts={externals}
				events={events}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		// All four nested cards render; sorting runs over every comparator branch.
		for (const sku of ["SKU-A", "SKU-B", "SKU-C", "SKU-D"]) {
			expect(screen.getByText(sku)).toBeOnTheScreen();
		}
	});

	it("sorts purely by reverse alphabetical when there are no events", async () => {
		const internal = makeInternal({ products: ["SKU-A", "SKU-B"] });
		await render(
			<InternalProductCard
				internalProduct={internal}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A" }),
					makeExternal({ unique_id_sku: "SKU-B" }),
				]}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		expect(screen.getByText("SKU-B")).toBeOnTheScreen();
	});

	it("breaks identical timestamps with reverse alphabetical order", async () => {
		const internal = makeInternal({ products: ["SKU-A", "SKU-B"] });
		const sameTime = "2026-04-01T00:00:00Z";
		const events: AuditEvent[] = [
			makeEvent({ id: 2, object_id: "SKU-A", timestamp: sameTime }),
			makeEvent({ id: 1, object_id: "SKU-B", timestamp: sameTime }),
		];
		await render(
			<InternalProductCard
				internalProduct={internal}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A" }),
					makeExternal({ unique_id_sku: "SKU-B" }),
				]}
				events={events}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		expect(screen.getByText("SKU-B")).toBeOnTheScreen();
	});

	it("renders with no external products at all", async () => {
		await render(
			<InternalProductCard
				internalProduct={makeInternal({ products: [] })}
				externalProducts={[]}
			/>,
		);
		expect(screen.getByText("0 external products")).toBeOnTheScreen();
		// totalQuantity is 0; threshold 10 -> "0 / 10".
		expect(screen.getByText("0")).toBeOnTheScreen();
		expect(screen.getByText("/ 10")).toBeOnTheScreen();
	});

	it("defaults a missing external status to active for counting and display", async () => {
		const external = makeExternal({ unique_id_sku: "SKU-A", quantity: 6 });
		// Exercise every `ext.status || "active"` fallback: the display filter
		// (showArchived path), the visible-list filter, and the total-quantity
		// reduce. showArchived:false keeps the visible-list filter on its
		// non-archived branch while still entering the display showArchived block.
		(external as { status?: "active" | "archived" }).status = undefined;
		await render(
			<InternalProductCard
				internalProduct={makeInternal()}
				externalProducts={[external]}
				selectedFilters={{ external: { showArchived: false } }}
			/>,
		);
		expect(screen.getByText("6")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
	});

	it("orders an external with events ahead of one without", async () => {
		const internal = makeInternal({ products: ["SKU-A", "SKU-B"] });
		const events: AuditEvent[] = [
			makeEvent({
				id: 1,
				object_id: "SKU-B",
				timestamp: "2026-04-01T00:00:00Z",
			}),
		];
		await render(
			<InternalProductCard
				internalProduct={internal}
				externalProducts={[
					makeExternal({ unique_id_sku: "SKU-A" }),
					makeExternal({ unique_id_sku: "SKU-B" }),
				]}
				events={events}
			/>,
		);
		await fireEvent.press(screen.getByText("chevron-down"));
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		expect(screen.getByText("SKU-B")).toBeOnTheScreen();
	});
});
