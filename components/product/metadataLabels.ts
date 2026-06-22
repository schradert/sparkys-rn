import { isMetadataItemArchived } from "@/constants/Products";

/**
 * Append an "(Archived)" suffix to any option whose metadata item is archived,
 * so edit-mode radio/multi-select sections still surface archived values while
 * marking them. Mirrors the `" (Archived)"` token the editors strip on save.
 */
export function addArchivedLabels(
	options: readonly string[],
	fieldKey: string,
): string[] {
	return options.map((option) =>
		isMetadataItemArchived(fieldKey, option) ? `${option} (Archived)` : option,
	);
}
