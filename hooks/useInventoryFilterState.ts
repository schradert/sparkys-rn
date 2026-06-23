/** State and handlers for the inventory filter selections. */

import { useEffect, useState } from "react";
import {
	defaultExternalFilters,
	defaultInternalFilters,
	type ExternalArrayFilterKey,
	type ExternalFilters,
	type InternalArrayFilterKey,
	type InternalFilters,
} from "@/components/inventory/types";

const INTERNAL_FILTER_KEYS = [
	"product_type",
	"texture",
	"shape",
	"occasions",
	"sparkys_color",
];
const EXTERNAL_FILTER_KEYS = [
	"manufacturer_color",
	"brand",
	"size",
	"distributors",
];

type MetadataChange = {
	fieldKey: string;
	oldValue: string;
	newValue: string;
};

/**
 * Apply a metadata rename to one filter set: if the renamed field is selected,
 * swap the old value for the new one in place. Returns the same reference when
 * nothing matches so React can skip the update.
 */
function renameSelectedValue<T extends InternalFilters | ExternalFilters>(
	prev: T,
	fieldKey: string,
	oldValue: string,
	newValue: string,
): T {
	const current = prev[fieldKey as keyof T];
	if (Array.isArray(current) && current.includes(oldValue)) {
		return {
			...prev,
			[fieldKey]: current.map((value) =>
				value === oldValue ? newValue : value,
			),
		};
	}
	return prev;
}

/**
 * Owns the inventory filter state: the internal/external selections, the
 * handlers that mutate them, the active-selection count, the metadata-pill
 * toggle, and the subscription that renames selected values when a metadata
 * item is renamed elsewhere.
 */
export function useInventoryFilterState(
	subscribeToMetadataChanges: (
		listener: (change: MetadataChange) => void,
	) => () => void,
) {
	const [internalFilters, setInternalFilters] = useState<InternalFilters>(
		defaultInternalFilters,
	);
	const [externalFilters, setExternalFilters] = useState<ExternalFilters>(
		defaultExternalFilters,
	);

	useEffect(() => {
		const unsubscribe = subscribeToMetadataChanges((change) => {
			const { fieldKey, oldValue, newValue } = change;
			if (INTERNAL_FILTER_KEYS.includes(fieldKey)) {
				setInternalFilters((prev) =>
					renameSelectedValue(prev, fieldKey, oldValue, newValue),
				);
			}
			if (EXTERNAL_FILTER_KEYS.includes(fieldKey)) {
				setExternalFilters((prev) =>
					renameSelectedValue(prev, fieldKey, oldValue, newValue),
				);
			}
		});
		return unsubscribe;
	}, [subscribeToMetadataChanges]);

	function clearAllFilters(): void {
		setInternalFilters(defaultInternalFilters);
		setExternalFilters(defaultExternalFilters);
	}

	function handleInternalFilterChange(
		category: keyof InternalFilters,
		values: string[],
	): void {
		setInternalFilters((prev) => ({ ...prev, [category]: values }));
	}

	function handleExternalFilterChange(
		category: keyof ExternalFilters,
		values: string[],
	): void {
		setExternalFilters((prev) => ({ ...prev, [category]: values }));
	}

	// Toggle a metadata pill into/out of the matching filter set.
	function handleMetadataPress(field: string, value: string): void {
		if (INTERNAL_FILTER_KEYS.includes(field)) {
			setInternalFilters((prev) => {
				const currentValues = prev[field as InternalArrayFilterKey];
				const newValues = currentValues.includes(value)
					? currentValues.filter((v) => v !== value)
					: [...currentValues, value];
				return { ...prev, [field]: newValues };
			});
		} else if (EXTERNAL_FILTER_KEYS.includes(field)) {
			setExternalFilters((prev) => {
				const currentValues = prev[field as ExternalArrayFilterKey];
				const newValues = currentValues.includes(value)
					? currentValues.filter((v) => v !== value)
					: [...currentValues, value];
				return { ...prev, [field]: newValues };
			});
		}
	}

	const totalSelections =
		Object.entries(internalFilters).reduce((sum, [key, value]) => {
			if (key === "understocked" || key === "showArchived") {
				return sum + (value ? 1 : 0);
			}
			return sum + (value as string[]).length;
		}, 0) +
		Object.entries(externalFilters).reduce((sum, [key, value]) => {
			if (key === "showArchived") {
				return sum + (value ? 1 : 0);
			}
			return sum + (value as string[]).length;
		}, 0);

	return {
		internalFilters,
		externalFilters,
		setInternalFilters,
		setExternalFilters,
		totalSelections,
		clearAllFilters,
		handleInternalFilterChange,
		handleExternalFilterChange,
		handleMetadataPress,
	};
}
