import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";

// Shared fixtures and mock plumbing for the Inventory screen tests. Lives
// outside __tests__ so Jest does not treat it as a suite. Each spec installs
// the same `jest.mock` factories (Jest hoists them per-file), but the
// controllable mock state and fixture builders live here so every spec agrees
// on shapes.

export type CameraPermission = {
	granted: boolean;
	canAskAgain: boolean;
	expires: "never";
	status: "granted" | "denied" | "undetermined";
} | null;

// Mutable controls read by the `jest.mock` factories in each spec.
export const cameraState: {
	permission: CameraPermission;
	requestPermission: jest.Mock;
	scanData: string;
} = {
	permission: {
		granted: true,
		canAskAgain: true,
		expires: "never",
		status: "granted",
	},
	requestPermission: jest.fn(),
	scanData: "SCAN-123",
};

export function resetCameraState(): void {
	cameraState.permission = {
		granted: true,
		canAskAgain: true,
		expires: "never",
		status: "granted",
	};
	cameraState.requestPermission = jest.fn();
	cameraState.scanData = "SCAN-123";
}

export type SheetsMock = {
	isRefreshing: boolean;
	error: string | null;
	refresh: jest.Mock;
	addMetadata: jest.Mock;
	addInternalProduct: jest.Mock;
	addExternalProduct: jest.Mock;
	updateInternalProduct: jest.Mock;
	subscribeToMetadataChanges: jest.Mock;
	// Optional in the real hook; tests that exercise the "no loader" path assign
	// undefined explicitly (see inventory.logic.test.tsx).
	getAuditEvents: jest.Mock;
};

// The metadata-change subscriber registered by the screen, captured so tests
// can fire a change through it.
export const sheetsControl: {
	metadataChangeListener:
		| ((change: {
				fieldKey: string;
				oldValue: string;
				newValue: string;
		  }) => void)
		| null;
	mock: SheetsMock;
} = {
	metadataChangeListener: null,
	mock: makeSheetsMock(),
};

export function makeSheetsMock(): SheetsMock {
	return {
		isRefreshing: false,
		error: null,
		refresh: jest.fn(),
		addMetadata: jest.fn(async () => ({ success: true })),
		addInternalProduct: jest.fn(async () => ({ success: true })),
		addExternalProduct: jest.fn(async () => ({ success: true })),
		updateInternalProduct: jest.fn(async () => ({ success: true })),
		subscribeToMetadataChanges: jest.fn(
			(
				listener: (change: {
					fieldKey: string;
					oldValue: string;
					newValue: string;
				}) => void,
			) => {
				sheetsControl.metadataChangeListener = listener;
				return () => {
					sheetsControl.metadataChangeListener = null;
				};
			},
		),
		getAuditEvents: jest.fn(async () => [] as AuditEvent[]),
	};
}

export function resetSheetsMock(): void {
	sheetsControl.mock = makeSheetsMock();
	sheetsControl.metadataChangeListener = null;
}

export function makeInternal(
	overrides: Partial<InternalProduct> = {},
): InternalProduct {
	return {
		id: "1",
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

export function makeExternal(
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

export function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: 1,
		timestamp: "2026-01-01T00:00:00.000Z",
		event_type: "quantity_update",
		object_type: "internal_product",
		object_id: "1",
		object_name: "Red Round Latex",
		changes: "{}",
		before_state: "{}",
		sheet_name: "internal",
		user_email: "t@example.com",
		...overrides,
	};
}

// Render a node inside a fresh QueryClient (retry off) so any react-query
// consumers in the tree behave deterministically.
export async function renderWithProviders(node: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
	);
}
