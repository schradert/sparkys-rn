/**
 * React entry point for the Google Sheets data layer.
 *
 * Subscribes to the shared sheets store and binds every operation (load,
 * refresh, product/metadata CRUD, audit logging) to the current access token,
 * so callers get the live state and ready-to-call, token-aware mutations.
 */

import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";
import {
	addMetadataToSheet,
	archiveMetadataInSheet,
	loadSheetsData,
	refreshSheetsData,
	unarchiveMetadataInSheet,
	updateMetadataInSheet,
} from "./sheetsData/operations";
import {
	addExternalProductToSheet,
	addInternalProductToSheet,
	archiveExternalProductInSheet,
	archiveInternalProductInSheet,
	getAuditEvents as getAuditEventsFromSheet,
	logAuditEvent as logAuditEventToSheet,
	unarchiveExternalProductInSheet,
	unarchiveInternalProductInSheet,
	updateExternalProductInSheet,
	updateInternalProductInSheet,
} from "./sheetsData/productOperations";
import {
	getSheetsState,
	type OperationResult,
	subscribeToMetadataChanges,
	subscribeToSheetsData,
	updateSheetsState,
} from "./sheetsData/store";
import { useAuth } from "./useAuth";

/** The no-token result shared by every authenticated mutation wrapper. */
const NO_TOKEN_RESULT: OperationResult = {
	success: false,
	error: "No access token",
};

/**
 * The shared sheets state spread together with all sheet operations bound to the
 * signed-in user's token. Auto-loads once on first sign-in and re-renders on
 * store changes; returns the data plus refresh and CRUD/audit actions.
 */
export function useSheetsData() {
	const [, forceUpdate] = useState({});
	const { getAccessToken, isSignedIn } = useAuth();

	useEffect(() => {
		return subscribeToSheetsData(() => forceUpdate({}));
	}, []);

	/**
	 * Resolve the access token, then run `withToken`. When no token is available
	 * the shared guard alerts and returns the no-token result (matching the
	 * original per-wrapper behavior); pass `onMissing` to override that fallback.
	 */
	const withAccessToken = useCallback(
		async <T,>(
			withToken: (accessToken: string) => Promise<T>,
			onMissing: () => T = () => {
				Alert.alert("Error", "No access token available");
				return NO_TOKEN_RESULT as T;
			},
		): Promise<T> => {
			const accessToken = await getAccessToken();
			if (!accessToken) return onMissing();
			return withToken(accessToken);
		},
		[getAccessToken],
	);

	const loadInitialData = useCallback(
		() =>
			withAccessToken(
				async (accessToken) => {
					await loadSheetsData(accessToken);
				},
				() => {
					updateSheetsState({
						error: "No access token available",
						isLoading: false,
					});
				},
			),
		[withAccessToken],
	);

	useEffect(() => {
		const state = getSheetsState();
		if (isSignedIn && !state.lastUpdated && !state.isLoading) {
			loadInitialData();
		}
	}, [isSignedIn, loadInitialData]);

	const refresh = () =>
		withAccessToken(
			(accessToken) => refreshSheetsData(accessToken),
			() => {
				Alert.alert("Error", "No access token available");
			},
		);

	const addMetadata = (sheetName: string, name: string) =>
		withAccessToken((accessToken) =>
			addMetadataToSheet(sheetName, name, accessToken),
		);

	const addInternalProduct = (product: InternalProductSheet) =>
		withAccessToken((accessToken) =>
			addInternalProductToSheet(product, accessToken),
		);

	const updateMetadata = (
		sheetName: string,
		oldName: string,
		newName: string,
	) =>
		withAccessToken((accessToken) =>
			updateMetadataInSheet(sheetName, oldName, newName, accessToken),
		);

	const addExternalProduct = (product: ExternalProductSheet) =>
		withAccessToken((accessToken) =>
			addExternalProductToSheet(product, accessToken),
		);

	const updateInternalProduct = (product: InternalProductSheet) =>
		withAccessToken((accessToken) =>
			updateInternalProductInSheet(product, accessToken),
		);

	const updateExternalProduct = (
		product: ExternalProductSheet,
		skipAuditLog = false,
	) =>
		withAccessToken((accessToken) =>
			updateExternalProductInSheet(product, accessToken, skipAuditLog),
		);

	const archiveMetadata = (sheetName: string, name: string) =>
		withAccessToken((accessToken) =>
			archiveMetadataInSheet(sheetName, name, accessToken),
		);

	const unarchiveMetadata = (sheetName: string, name: string) =>
		withAccessToken((accessToken) =>
			unarchiveMetadataInSheet(sheetName, name, accessToken),
		);

	const logAuditEvent = (event: Omit<AuditEvent, "id" | "user_email">) =>
		withAccessToken(
			(accessToken) => logAuditEventToSheet(event, accessToken),
			() => undefined,
		);

	const getAuditEvents = useCallback(
		(limit = 50, offset = 0) =>
			withAccessToken(
				(accessToken) => getAuditEventsFromSheet(accessToken, limit, offset),
				() => {
					Alert.alert("Error", "No access token available");
					return [] as Awaited<ReturnType<typeof getAuditEventsFromSheet>>;
				},
			),
		[withAccessToken],
	);

	const archiveExternalProduct = (sku: string) =>
		withAccessToken((accessToken) =>
			archiveExternalProductInSheet(sku, accessToken),
		);

	const unarchiveExternalProduct = (sku: string) =>
		withAccessToken((accessToken) =>
			unarchiveExternalProductInSheet(sku, accessToken),
		);

	const archiveInternalProduct = (name: string) =>
		withAccessToken((accessToken) =>
			archiveInternalProductInSheet(name, accessToken),
		);

	const unarchiveInternalProduct = (name: string) =>
		withAccessToken((accessToken) =>
			unarchiveInternalProductInSheet(name, accessToken),
		);

	return {
		...getSheetsState(),
		refresh,
		loadInitialData,
		addMetadata,
		addInternalProduct,
		updateMetadata,
		addExternalProduct,
		updateInternalProduct,
		updateExternalProduct,
		archiveMetadata,
		unarchiveMetadata,
		archiveExternalProduct,
		unarchiveExternalProduct,
		archiveInternalProduct,
		unarchiveInternalProduct,
		subscribeToMetadataChanges,
		logAuditEvent,
		getAuditEvents,
	};
}
