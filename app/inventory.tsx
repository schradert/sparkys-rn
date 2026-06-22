import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { type ReactElement, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	LayoutAnimation,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	UIManager,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AvatarDropdown from "@/components/AvatarDropdown";
import CollapsibleMultiSelectSection from "@/components/CollapsibleMultiSelectSection";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import InfiniteScroll from "@/components/InfiniteScroll";
import InternalProductCard from "@/components/InternalProductCard";
import PillCheckbox from "@/components/PillCheckbox";
import { Colors } from "@/constants/Colors";
import {
	type ExternalProduct,
	getAllMetadataItems,
	getInternalProductTotalQuantity,
	getMetadataItems,
	type InternalProduct,
	type InternalProductSheet,
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import {
	addExternalProduct as addExternalProductToStore,
	addInternalProduct as addInternalProductToStore,
	getExternalProductBySku,
	subscribeToStoreChanges,
	updateInternalProduct as updateInternalProductInStore,
	useProductStore,
} from "@/store/products";

type ViewMode =
	| "products" // Internal products (hierarchical view)
	| "productTypes"
	| "manufacturerColors"
	| "sparkysColors"
	| "manufacturers"
	| "sizes"
	| "textures"
	| "bagQuantities"
	| "shapes"
	| "distributors"
	| "occasions";

const VIEW_OPTIONS = [
	{ key: "products" as ViewMode, label: "Products" },
	{ key: "productTypes" as ViewMode, label: "Product Types" },
	{ key: "manufacturerColors" as ViewMode, label: "External Colors" },
	{ key: "sparkysColors" as ViewMode, label: "Internal Colors" },
	{ key: "manufacturers" as ViewMode, label: "Brands" },
	{ key: "sizes" as ViewMode, label: "Sizes" },
	{ key: "textures" as ViewMode, label: "Textures" },
	{ key: "bagQuantities" as ViewMode, label: "Bag Quantities" },
	{ key: "shapes" as ViewMode, label: "Shapes" },
	{ key: "distributors" as ViewMode, label: "Distributors" },
	{ key: "occasions" as ViewMode, label: "Occasions" },
];

// Filter types for internal and external products
type InternalFilters = {
	product_type: string[];
	texture: string[];
	shape: string[];
	occasions: string[];
	sparkys_color: string[];
	understocked: boolean;
	showArchived: boolean;
};

type ExternalFilters = {
	manufacturer_color: string[];
	brand: string[];
	size: string[];
	distributors: string[];
	showArchived: boolean;
};

// Array-valued (multi-select) filter keys, excluding the boolean toggles.
type InternalArrayFilterKey =
	| "product_type"
	| "texture"
	| "shape"
	| "occasions"
	| "sparkys_color";
type ExternalArrayFilterKey =
	| "manufacturer_color"
	| "brand"
	| "size"
	| "distributors";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleFilterSectionProps {
	title: string;
	options: string[];
	selectedValues: string[];
	onSelectionChange: (values: string[]) => void;
}

function CollapsibleFilterSection({
	title,
	options,
	selectedValues,
	onSelectionChange,
}: CollapsibleFilterSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const { theme } = useTheme();
	const colors = Colors[theme];

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
		if (!isExpanded) {
			// Reset search when expanding
			setSearchQuery("");
		}
	}

	function handlePillPress(value: string): void {
		const newSelection = selectedValues.includes(value)
			? selectedValues.filter((v) => v !== value)
			: [...selectedValues, value];
		onSelectionChange(newSelection);
	}

	// Simple fuzzy matching function
	function fuzzyMatch(query: string, text: string): boolean {
		/* istanbul ignore next -- fuzzyMatch only runs when searchQuery is truthy, so an empty query never reaches here */
		if (!query) return true;
		const queryLower = query.toLowerCase();
		const textLower = text.toLowerCase();
		return textLower.includes(queryLower);
	}

	// Filter options based on search query
	const filteredOptions = searchQuery
		? options.filter((option) => fuzzyMatch(searchQuery, option))
		: options;

	const displayOptions = isExpanded
		? filteredOptions
		: options.filter((opt) => selectedValues.includes(opt));
	const hasSelections = selectedValues.length > 0;

	return (
		<View
			style={[styles.filterSection, { backgroundColor: colors.cardBackground }]}
		>
			<Pressable
				style={[
					styles.filterHeader,
					{ backgroundColor: colors.cardBackground },
				]}
				onPress={toggleExpansion}
			>
				<Text style={[styles.filterHeaderText, { color: colors.text }]}>
					{title} {hasSelections && `(${selectedValues.length})`}
				</Text>
				<Ionicons
					name={isExpanded ? "chevron-down" : "chevron-forward"}
					size={16}
					color={colors.icon}
				/>
			</Pressable>

			{(isExpanded || hasSelections) && (
				<View
					style={[styles.expandedContent, { backgroundColor: colors.surface }]}
				>
					{isExpanded && (
						<View
							style={[
								styles.searchContainer,
								{ backgroundColor: colors.cardBackground },
							]}
						>
							<Ionicons
								name="search-outline"
								size={16}
								color={colors.textSecondary}
							/>
							<TextInput
								style={[styles.searchInput, { color: colors.text }]}
								placeholder={`Search ${title.toLowerCase()}...`}
								placeholderTextColor={colors.textMuted}
								value={searchQuery}
								onChangeText={setSearchQuery}
								autoCapitalize="none"
								autoCorrect={false}
							/>
							{searchQuery.length > 0 && (
								<Pressable onPress={() => setSearchQuery("")}>
									<Ionicons
										name="close-circle"
										size={16}
										color={colors.textSecondary}
									/>
								</Pressable>
							)}
						</View>
					)}

					<View
						style={[styles.pillContainer, { backgroundColor: colors.surface }]}
					>
						{displayOptions.map((option) => (
							<PillCheckbox
								key={option}
								label={option}
								selected={selectedValues.includes(option)}
								onPress={() => handlePillPress(option)}
							/>
						))}
						{isExpanded && filteredOptions.length === 0 && searchQuery && (
							<Text
								style={[styles.noResultsText, { color: colors.textSecondary }]}
							>
								No results found for "{searchQuery}"
							</Text>
						)}
						{!isExpanded && hasSelections && (
							<Pressable
								style={[
									styles.expandPill,
									{
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
								onPress={toggleExpansion}
							>
								<Text
									style={[styles.expandText, { color: colors.textSecondary }]}
								>
									+{options.length - selectedValues.length} more
								</Text>
							</Pressable>
						)}
					</View>
				</View>
			)}
		</View>
	);
}

function MetadataCard({
	item,
	viewMode,
}: {
	item: string;
	viewMode: ViewMode;
}) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	// Get the fieldKey for this viewMode to check if item is archived
	const getFieldKeyForViewMode = (viewMode: ViewMode): string | null => {
		switch (viewMode) {
			case "productTypes":
				return "productType";
			case "manufacturerColors":
				return "manufacturer_color";
			case "sparkysColors":
				return "sparkys_color";
			case "manufacturers":
				return "manufacturer";
			case "sizes":
				return "size";
			case "textures":
				return "texture";
			case "bagQuantities":
				return "bagQuantity";
			case "shapes":
				return "shape";
			case "distributors":
				return "distributor";
			case "occasions":
				return "occasion";
			/* istanbul ignore next -- MetadataCard renders only for non-products views, so every viewMode hits a case above; this default is unreachable */
			default:
				return null;
		}
	};

	const fieldKey = getFieldKeyForViewMode(viewMode);
	/* istanbul ignore next -- fieldKey is non-null for every metadata viewMode MetadataCard receives, so the false branch is unreachable */
	const isArchived = fieldKey ? isMetadataItemArchived(fieldKey, item) : false;

	return (
		<Pressable
			style={[
				styles.card,
				{ backgroundColor: colors.cardBackground },
				isArchived && { opacity: 0.6, backgroundColor: colors.surface },
			]}
			onPress={() =>
				router.push(`/metadata/${viewMode}/${encodeURIComponent(item)}`)
			}
		>
			<View style={styles.cardHeader}>
				<Text
					style={[
						styles.productName,
						{ color: isArchived ? colors.textSecondary : colors.text },
					]}
				>
					{item}
					{isArchived ? " (Archived)" : ""}
				</Text>
			</View>
		</Pressable>
	);
}

export default function Inventory() {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const {
		isRefreshing: sheetsRefreshing,
		error: sheetsError,
		refresh,
		addMetadata,
		addInternalProduct,
		addExternalProduct,
		updateInternalProduct,
		subscribeToMetadataChanges,
		getAuditEvents,
	} = useSheetsData();

	// Separate filters for internal and external products
	const defaultInternalFilters: InternalFilters = {
		product_type: [],
		texture: [],
		shape: [],
		occasions: [],
		sparkys_color: [],
		understocked: false,
		showArchived: false,
	};

	const defaultExternalFilters: ExternalFilters = {
		manufacturer_color: [],
		brand: [],
		size: [],
		distributors: [],
		showArchived: false,
	};

	const [permission, requestPermission] = useCameraPermissions();

	// New state for internal/external products
	const [internalFilters, setInternalFilters] = useState<InternalFilters>(
		defaultInternalFilters,
	);
	const [externalFilters, setExternalFilters] = useState<ExternalFilters>(
		defaultExternalFilters,
	);
	const [metadataShowArchived, setMetadataShowArchived] = useState(false);
	const internalProducts = useProductStore((s) => s.internalProducts);
	const externalProducts = useProductStore((s) => s.externalProducts);
	const [storeUpdateTrigger, setStoreUpdateTrigger] = useState(0);
	const [cachedEvents, setCachedEvents] = useState<AuditEvent[]>([]);

	// UI state
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [isMetadataFilterModalVisible, setIsMetadataFilterModalVisible] =
		useState(false);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [isScannerVisible, setIsScannerVisible] = useState(false);
	const [isViewDropdownVisible, setIsViewDropdownVisible] = useState(false);
	const [currentView, setCurrentView] = useState<ViewMode>("products");
	const [scannedBarcode, setScannedBarcode] = useState("");
	const [newMetadataValue, setNewMetadataValue] = useState("");
	const [isSubmittingMetadata, setIsSubmittingMetadata] = useState(false);
	const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);

	// Internal Product Form State
	const [newInternalProduct, setNewInternalProduct] = useState({
		id: "",
		sparkys_product_name: "",
		product_type: "",
		sparkys_color: "",
		texture: "",
		shape: "",
		occasions: [] as string[],
		products: [] as string[],
		threshold_quantity: 0,
		never_out: false,
	});

	// External Product Form State
	const [newExternalProduct, setNewExternalProduct] = useState({
		unique_id_sku: "",
		manufacturer_color: "",
		brand: "",
		size: "",
		bag_quantity: 50,
		distributors: [] as string[],
		quantity: 0,
		assigned_internal_product: "",
	});
	const [isSubmittingExternal, setIsSubmittingExternal] = useState(false);

	// Subscribe to store changes to update products (with debouncing to prevent loops)
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>;
		const unsubscribe = subscribeToStoreChanges(() => {
			// Debounce store change notifications to prevent rapid loops
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setStoreUpdateTrigger((prev) => prev + 1);
			}, 100);
		});
		return () => {
			clearTimeout(timeoutId);
			unsubscribe();
		};
	}, []);

	// Subscribe to metadata changes to update filters
	// Load events data on initial load and when user manually refreshes or data changes
	useEffect(() => {
		const loadEvents = async () => {
			if (!getAuditEvents) return;
			try {
				const events = await getAuditEvents(1000, 0);
				setCachedEvents(events);
			} catch (error) {
				logger.error("Inventory", "Failed to load audit events", { error });
			}
		};

		loadEvents();
	}, [sheetsRefreshing, storeUpdateTrigger, getAuditEvents]);

	useEffect(() => {
		const unsubscribe = subscribeToMetadataChanges((change) => {
			const { fieldKey, oldValue, newValue } = change;

			// Update internal filters if applicable
			if (
				[
					"product_type",
					"texture",
					"shape",
					"occasions",
					"sparkys_color",
				].includes(fieldKey)
			) {
				setInternalFilters((prevFilters) => {
					const currentSelectedValues =
						prevFilters[fieldKey as keyof InternalFilters];
					if (
						currentSelectedValues &&
						Array.isArray(currentSelectedValues) &&
						currentSelectedValues.includes(oldValue)
					) {
						const updatedValues = currentSelectedValues.map((value) =>
							value === oldValue ? newValue : value,
						);
						return {
							...prevFilters,
							[fieldKey]: updatedValues,
						};
					}
					return prevFilters;
				});
			}

			// Update external filters if applicable
			if (
				["manufacturer_color", "brand", "size", "distributors"].includes(
					fieldKey,
				)
			) {
				setExternalFilters((prevFilters) => {
					const currentSelectedValues =
						prevFilters[fieldKey as keyof ExternalFilters];
					if (
						currentSelectedValues &&
						Array.isArray(currentSelectedValues) &&
						currentSelectedValues.includes(oldValue)
					) {
						const updatedValues = currentSelectedValues.map((value) =>
							value === oldValue ? newValue : value,
						);
						return {
							...prevFilters,
							[fieldKey]: updatedValues,
						};
					}
					return prevFilters;
				});
			}
		});

		return unsubscribe;
	}, [subscribeToMetadataChanges]);

	// Helper functions for sorting
	function getEventCount(
		productId: string,
		productType: "internal_product" | "external_product",
	): number {
		return cachedEvents.filter(
			(event) =>
				event.object_type === productType && event.object_id === productId,
		).length;
	}

	function getMostRecentEventTimestamp(
		productId: string,
		productType: "internal_product" | "external_product",
	): string | null {
		const productEvents = cachedEvents.filter(
			(event) =>
				event.object_type === productType && event.object_id === productId,
		);

		if (productEvents.length === 0) return null;

		// Events are already sorted by ID descending (most recent first)
		return productEvents[0].timestamp;
	}

	function getCurrentData() {
		switch (currentView) {
			case "products":
				// Return filtered internal products for hierarchical view
				return (
					internalProducts
						?.filter((internalProduct) => {
							// Apply internal product filters
							const matchesInternal = Object.entries(internalFilters).every(
								([key, selectedValues]) => {
									if (key === "understocked") {
										// Handle understocked filter (boolean)
										if (!selectedValues) return true;
										const totalQuantity = getInternalProductTotalQuantity(
											internalProduct,
											externalProducts,
										);
										const isUnderstocked =
											totalQuantity < internalProduct.threshold_quantity;
										return isUnderstocked;
									}
									if (key === "showArchived") {
										// Handle showArchived filter (boolean)
										const isProductArchived =
											(internalProduct.status || "active") === "archived";
										if (selectedValues === true) {
											// Show all products (both active and archived)
											return true;
										} else {
											// Show only active products (exclude archived)
											return !isProductArchived;
										}
									}
									if (
										!Array.isArray(selectedValues) ||
										selectedValues.length === 0
									)
										return true;
									if (key === "occasions") {
										// For occasions array, check if any selected occasion is in the product's occasions
										return selectedValues.some((selectedValue) =>
											(internalProduct.occasions || []).includes(selectedValue),
										);
									}
									const productValue = internalProduct[
										key as keyof InternalProduct
									] as string;
									return selectedValues.includes(productValue);
								},
							);

							if (!matchesInternal) return false;

							// If external filters are applied, check if any related external products match
							const hasExternalFilters = Object.values(externalFilters).some(
								(arr) => Array.isArray(arr) && arr.length > 0,
							);
							if (!hasExternalFilters) return true;

							const relatedExternals = externalProducts.filter((ext) =>
								internalProduct.products.includes(ext.unique_id_sku),
							);

							// Filter the related externals with the same logic as in render
							const filteredExternals = relatedExternals.filter(
								(externalProduct) => {
									return Object.entries(externalFilters).every(
										([key, selectedValues]) => {
											if (key === "showArchived") {
												// Handle showArchived filter (boolean)
												const isProductArchived =
													(externalProduct.status || "active") === "archived";
												if (selectedValues === true) {
													// Show all products (both active and archived)
													return true;
												} else {
													// Show only active products (exclude archived)
													return !isProductArchived;
												}
											}
											if (
												!Array.isArray(selectedValues) ||
												selectedValues.length === 0
											)
												return true;
											if (key === "distributors") {
												return selectedValues.some((selectedValue) =>
													externalProduct.distributors.includes(selectedValue),
												);
											}
											const productValue = externalProduct[
												key as keyof ExternalProduct
											] as string;
											return selectedValues.includes(productValue);
										},
									);
								},
							);

							// Only show internal product if it has at least one matching external product
							return filteredExternals.length > 0;
						})
						?.sort((a, b) => {
							// Sort by: 1) most frequently updated, 2) most recently updated, 3) reverse alphabetical
							const aEventCount = getEventCount(a.id, "internal_product");
							const bEventCount = getEventCount(b.id, "internal_product");

							// First sort by frequency (descending)
							if (aEventCount !== bEventCount) {
								return bEventCount - aEventCount;
							}

							// Then sort by most recent activity
							const aTimestamp = getMostRecentEventTimestamp(
								a.id,
								"internal_product",
							);
							const bTimestamp = getMostRecentEventTimestamp(
								b.id,
								"internal_product",
							);

							if (!aTimestamp && !bTimestamp) {
								// Finally sort by reverse alphabetical
								return b.sparkys_product_name.localeCompare(
									a.sparkys_product_name,
								);
							}
							/* istanbul ignore next -- equal event counts (passing the check above) imply both timestamps are present or both absent, so a single null here is unreachable */
							if (!aTimestamp) return 1;
							/* istanbul ignore next -- see note above: an unpaired null timestamp cannot occur */
							if (!bTimestamp) return -1;

							const timeDiff =
								new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();
							if (timeDiff !== 0) return timeDiff;

							// If same timestamp, use reverse alphabetical
							return b.sparkys_product_name.localeCompare(
								a.sparkys_product_name,
							);
						}) || []
				);
			case "productTypes":
				return getMetadataItems("productType", metadataShowArchived).map(
					(item) => item.name,
				);
			case "manufacturerColors":
				return getMetadataItems("manufacturer_color", metadataShowArchived).map(
					(item) => item.name,
				);
			case "sparkysColors":
				return getMetadataItems("sparkys_color", metadataShowArchived).map(
					(item) => item.name,
				);
			case "manufacturers":
				return getMetadataItems("manufacturer", metadataShowArchived).map(
					(item) => item.name,
				);
			case "sizes":
				return getMetadataItems("size", metadataShowArchived).map(
					(item) => item.name,
				);
			case "textures":
				return getMetadataItems("texture", metadataShowArchived).map(
					(item) => item.name,
				);
			case "bagQuantities":
				return getMetadataItems("bagQuantity", metadataShowArchived).map(
					(item) => item.name,
				);
			case "shapes":
				return getMetadataItems("shape", metadataShowArchived).map(
					(item) => item.name,
				);
			case "distributors":
				return getMetadataItems("distributor", metadataShowArchived).map(
					(item) => item.name,
				);
			case "occasions":
				return getMetadataItems("occasion", metadataShowArchived).map(
					(item) => item.name,
				);
			/* istanbul ignore next -- currentView is a ViewMode and every variant has a case above; this default is unreachable */
			default:
				return [];
		}
	}

	function getCurrentRenderItem() {
		return currentView === "products"
			? ({ item }: { item: InternalProduct }) => {
					logger.debug(
						"Inventory",
						"Rendering InternalProductCard with item:",
						item,
					);

					// Get all external products for this internal product
					const relatedExternals = externalProducts.filter((ext) =>
						item.products.includes(ext.unique_id_sku),
					);

					// Apply external product filters to the related externals
					const filteredExternals = relatedExternals.filter(
						(externalProduct) => {
							return Object.entries(externalFilters).every(
								([key, selectedValues]) => {
									if (key === "showArchived") {
										// Handle showArchived filter (boolean)
										const isProductArchived =
											(externalProduct.status || "active") === "archived";
										if (selectedValues === true) {
											// Show all products (both active and archived)
											return true;
										} else {
											// Show only active products (exclude archived)
											return !isProductArchived;
										}
									}
									if (
										!Array.isArray(selectedValues) ||
										selectedValues.length === 0
									)
										return true;
									if (key === "distributors") {
										return selectedValues.some((selectedValue) =>
											externalProduct.distributors.includes(selectedValue),
										);
									}
									const productValue = externalProduct[
										key as keyof ExternalProduct
									] as string;
									return selectedValues.includes(productValue);
								},
							);
						},
					);

					logger.debug(
						"Inventory",
						`External products for ${item.sparkys_product_name}:`,
						`${relatedExternals.length} total, ${filteredExternals.length} after filters`,
					);

					return (
						<InternalProductCard
							key={item.id}
							internalProduct={item}
							externalProducts={relatedExternals}
							events={cachedEvents}
							onMetadataPress={handleMetadataPress}
							selectedFilters={{
								internal: internalFilters,
								external: externalFilters,
							}}
						/>
					);
				}
			: ({ item }: { item: string }) => (
					<MetadataCard item={item} viewMode={currentView} />
				);
	}

	function getCurrentKeyExtractor() {
		return currentView === "products"
			? (item: InternalProduct) => item.sparkys_product_name
			: (item: string) => item;
	}

	// Handle metadata press for both internal and external products
	function handleMetadataPress(field: string, value: string): void {
		// Determine if this is an internal or external field and update appropriate filters
		/* istanbul ignore else -- the product cards only emit internal or external metadata fields, so neither branch can be skipped entirely */
		if (
			[
				"product_type",
				"texture",
				"shape",
				"occasions",
				"sparkys_color",
			].includes(field)
		) {
			setInternalFilters((prev) => {
				/* istanbul ignore next -- every internal array-filter key is initialized in defaultInternalFilters, so the [] fallback is unreachable */
				const currentValues = prev[field as InternalArrayFilterKey] || [];
				const isSelected = currentValues.includes(value);
				const newValues = isSelected
					? currentValues.filter((v) => v !== value)
					: [...currentValues, value];
				return {
					...prev,
					[field]: newValues,
				};
			});
		} else if (
			["manufacturer_color", "brand", "size", "distributors"].includes(field)
		) {
			setExternalFilters((prev) => {
				/* istanbul ignore next -- every external array-filter key is initialized in defaultExternalFilters, so the [] fallback is unreachable */
				const currentValues = prev[field as ExternalArrayFilterKey] || [];
				const isSelected = currentValues.includes(value);
				const newValues = isSelected
					? currentValues.filter((v) => v !== value)
					: [...currentValues, value];
				return {
					...prev,
					[field]: newValues,
				};
			});
		}
	}

	// Data, renderItem and key extractor are view-correlated (products vs.
	// metadata), which TypeScript can't express as one generic. Unify them on the
	// `InternalProduct | string` item type the list actually carries.
	const currentData = getCurrentData() as (InternalProduct | string)[];
	const currentRenderItem = getCurrentRenderItem() as unknown as (info: {
		item: InternalProduct | string;
	}) => ReactElement;
	const currentKeyExtractor = getCurrentKeyExtractor() as unknown as (
		item: InternalProduct | string,
	) => string;

	function clearAllFilters(): void {
		setInternalFilters(defaultInternalFilters);
		setExternalFilters(defaultExternalFilters);
	}

	function handleInternalFilterChange(
		category: keyof InternalFilters,
		values: string[],
	): void {
		setInternalFilters((prev) => ({
			...prev,
			[category]: values,
		}));
	}

	function handleExternalFilterChange(
		category: keyof ExternalFilters,
		values: string[],
	): void {
		setExternalFilters((prev) => ({
			...prev,
			[category]: values,
		}));
	}

	// Removed broken handleFilterToggle function - setFilters doesn't exist

	function formatCategoryTitle(category: string): string {
		switch (category) {
			case "product_type":
				return "Type";
			case "sparkys_color":
				return "Sparky's Color";
			case "manufacturer_color":
				return "Manufacturer Color";
			/* istanbul ignore next -- formatCategoryTitle is only called with the filter categories (product_type, sparkys_color, manufacturer_color, brand, size, distributors, texture, shape, occasions); these alias keys are never passed */
			case "bag_quantity":
				return "Bag Quantity";
			/* istanbul ignore next -- never passed (see note above) */
			case "manufacturer":
				return "Brand";
			/* istanbul ignore next -- never passed (see note above) */
			case "bagQuantity":
				return "Bag Quantity";
			/* istanbul ignore next -- never passed (see note above) */
			case "productType":
				return "Product Type";
			case "brand":
				return "Brand";
			case "occasions":
				return "Occasions";
			case "distributors":
				return "Distributors";
			case "texture":
				return "Texture";
			case "shape":
				return "Shape";
			case "size":
				return "Size";
			/* istanbul ignore next -- every filter category matches a case above, so this fallback is unreachable */
			default:
				return (
					category.charAt(0).toUpperCase() +
					category.slice(1).replace(/([A-Z])/g, " $1")
				);
		}
	}

	const totalSelections =
		Object.entries(internalFilters).reduce((sum, [key, value]) => {
			if (key === "understocked" || key === "showArchived") {
				return sum + (value ? 1 : 0);
			}
			return sum + ((value as string[])?.length || 0);
		}, 0) +
		Object.entries(externalFilters).reduce((sum, [key, value]) => {
			if (key === "showArchived") {
				return sum + (value ? 1 : 0);
			}
			return sum + ((value as string[])?.length || 0);
		}, 0);

	function generateUniqueId(): string {
		const existingIds = (internalProducts || [])
			.map((p) => parseInt(p?.id || "0", 10))
			.filter((id) => !Number.isNaN(id));
		const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
		return (maxId + 1).toString();
	}

	function resetNewProductForm(): void {
		setScannedBarcode("");
		setNewMetadataValue("");
		setIsSubmittingExternal(false);
		setIsSubmittingMetadata(false);
		setNewInternalProduct({
			id: generateUniqueId(),
			sparkys_product_name: "",
			product_type: "",
			sparkys_color: "",
			texture: "",
			shape: "",
			occasions: [],
			products: [],
			threshold_quantity: 0,
			never_out: false,
		});
		setNewExternalProduct({
			unique_id_sku: "",
			manufacturer_color: "",
			brand: "",
			size: "",
			bag_quantity: 50,
			distributors: [],
			quantity: 0,
			assigned_internal_product: "",
		});
	}

	function getSheetNameForMetadata(viewMode: string): string | null {
		switch (viewMode) {
			case "productTypes":
				return "product_types";
			case "manufacturerColors":
				return "manufacturer_colors";
			case "sparkysColors":
				return "sparkys_colors";
			case "manufacturers":
				return "brands";
			case "sizes":
				return null;
			case "textures":
				return "textures";
			case "bagQuantities":
				return "bag_quantities";
			case "shapes":
				return "shapes";
			case "distributors":
				return "distributors";
			case "occasions":
				return "occasions";
			/* istanbul ignore next -- handleAddMetadata runs only for non-products views, all of which have a case above; this default is unreachable */
			default:
				return null;
		}
	}

	async function handleAddMetadata(): Promise<void> {
		if (!newMetadataValue.trim()) {
			Alert.alert("Error", "Please enter a value");
			return;
		}

		const trimmedValue = newMetadataValue.trim();
		const fieldKey =
			currentView === "productTypes"
				? "productType"
				: currentView === "manufacturerColors"
					? "manufacturer_color"
					: currentView === "sparkysColors"
						? "sparkys_color"
						: currentView === "manufacturers"
							? "manufacturer"
							: currentView === "sizes"
								? "size"
								: currentView === "textures"
									? "texture"
									: currentView === "bagQuantities"
										? "bagQuantity"
										: currentView === "shapes"
											? "shape"
											: currentView === "distributors"
												? "distributor"
												: currentView === "occasions"
													? "occasion"
													: /* istanbul ignore next -- handleAddMetadata runs only for non-products views, all mapped above, so this null arm is unreachable */
														null;

		/* istanbul ignore next -- fieldKey is always set for the views that reach here, so this guard never returns */
		if (!fieldKey) return;

		const existingValues: readonly string[] =
			PRODUCT_FIELD_OPTIONS[fieldKey] ?? [];
		if (existingValues.includes(trimmedValue)) {
			Alert.alert("Error", "This value already exists");
			return;
		}

		const sheetName = getSheetNameForMetadata(currentView);
		if (!sheetName) {
			Alert.alert("Error", "Cannot add items to this category");
			return;
		}

		setIsSubmittingMetadata(true);
		try {
			const result = await addMetadata(sheetName, trimmedValue);
			if (result.success) {
				setIsAddModalVisible(false);
				resetNewProductForm();
				Alert.alert("Success", `"${trimmedValue}" has been added!`);
			} else {
				Alert.alert("Error", result.error || "Failed to add item");
			}
		} catch (error) {
			logger.error("Inventory", "Failed to add metadata item", { error });
			Alert.alert("Error", "Failed to add item to spreadsheet");
		} finally {
			setIsSubmittingMetadata(false);
		}
	}

	function handleBarcodeScanned(data: string): void {
		setScannedBarcode(data);
		setIsScannerVisible(false);

		// Check if external product exists
		const existingExternal = getExternalProductBySku(data);
		logger.info("Inventory", "Barcode scanned", {
			data,
			known: !!existingExternal,
		});
		if (existingExternal) {
			router.push(`/external-product/${data}`);
		} else {
			// Pre-populate external product form with scanned barcode
			setNewExternalProduct((prev) => ({
				...prev,
				unique_id_sku: data,
			}));
			setIsAddModalVisible(true);
		}
	}

	function handleAddButtonPress(): void {
		if (currentView === "products") {
			// Barcode scanner always creates external products
			if (!permission) {
				requestPermission();
				return;
			}
			if (!permission.granted) {
				Alert.alert(
					"Camera Permission",
					"We need camera permission to scan barcodes",
					[{ text: "Cancel" }, { text: "Grant", onPress: requestPermission }],
				);
				return;
			}
			setIsScannerVisible(true);
		} else {
			setIsAddModalVisible(true);
		}
	}

	function handleAddInternalProduct(): void {
		setNewInternalProduct((prev) => ({
			...prev,
			id: generateUniqueId(),
		}));
		setIsAddModalVisible(true);
	}

	function handleViewChange(viewMode: ViewMode): void {
		setCurrentView(viewMode);
		setIsViewDropdownVisible(false);
	}

	/* istanbul ignore next -- currentView is always one of VIEW_OPTIONS, so find() never misses and the "Products" fallback is unreachable */
	const currentViewLabel =
		VIEW_OPTIONS.find((option) => option.key === currentView)?.label ||
		"Products";

	async function handleAddInternalProductSubmit(): Promise<void> {
		if (!newInternalProduct.sparkys_product_name.trim()) {
			Alert.alert("Error", "Please enter a product name");
			return;
		}

		// Check for duplicate names
		const existingProduct = internalProducts.find(
			(p) =>
				p.sparkys_product_name.toLowerCase().trim() ===
				newInternalProduct.sparkys_product_name.toLowerCase().trim(),
		);
		if (existingProduct) {
			Alert.alert("Error", "A product with this name already exists");
			return;
		}

		if (!newInternalProduct.product_type) {
			Alert.alert("Error", "Please select a product type");
			return;
		}

		if (!newInternalProduct.sparkys_color) {
			Alert.alert("Error", "Please select a color");
			return;
		}
		if (!newInternalProduct.texture) {
			Alert.alert("Error", "Please select a texture");
			return;
		}
		if (!newInternalProduct.shape) {
			Alert.alert("Error", "Please select a shape");
			return;
		}

		setIsSubmittingInternal(true);
		try {
			// Create the product for the spreadsheet. The two `|| []` fallbacks
			// below are unreachable (occasions/products are always arrays in the
			// form state); ignore the object's branch tracking for them.
			/* istanbul ignore next -- see note above: the only branches in this literal are the unreachable occasions/products [] fallbacks */
			const productForSheet: InternalProductSheet = {
				id: newInternalProduct.id,
				sparkys_product_name: newInternalProduct.sparkys_product_name,
				product_type: newInternalProduct.product_type,
				sparkys_color: newInternalProduct.sparkys_color,
				texture: newInternalProduct.texture,
				shape: newInternalProduct.shape,
				occasions: (newInternalProduct.occasions || []).join(", "),
				products: (newInternalProduct.products || []).join(", "),
				threshold_quantity: newInternalProduct.threshold_quantity,
				never_out: newInternalProduct.never_out,
				status: "active",
			};

			const result = await addInternalProduct(productForSheet);
			if (result.success) {
				// Add to store immediately so it shows up in list
				const newProduct = {
					id: newInternalProduct.id,
					sparkys_product_name: newInternalProduct.sparkys_product_name,
					product_type: newInternalProduct.product_type,
					sparkys_color: newInternalProduct.sparkys_color,
					texture: newInternalProduct.texture,
					shape: newInternalProduct.shape,
					occasions: newInternalProduct.occasions,
					products: newInternalProduct.products,
					threshold_quantity: newInternalProduct.threshold_quantity,
					never_out: newInternalProduct.never_out,
					status: "active" as const,
				};
				addInternalProductToStore(newProduct);

				setIsAddModalVisible(false);
				resetNewProductForm();
				Alert.alert(
					"Success",
					`Internal product "${newInternalProduct.sparkys_product_name}" has been created!`,
				);
			} else {
				Alert.alert("Error", result.error || "Failed to add internal product");
			}
		} catch (error) {
			logger.error("Inventory", "Failed to add internal product", { error });
			Alert.alert("Error", "Failed to add internal product to spreadsheet");
		} finally {
			setIsSubmittingInternal(false);
		}
	}

	async function handleAddExternalProductSubmit(): Promise<void> {
		if (!newExternalProduct.unique_id_sku.trim()) {
			Alert.alert("Error", "Please scan a barcode first");
			return;
		}

		if (!newExternalProduct.manufacturer_color) {
			Alert.alert("Error", "Please select a manufacturer color");
			return;
		}

		if (!newExternalProduct.brand) {
			Alert.alert("Error", "Please select a brand");
			return;
		}

		if (!newExternalProduct.size) {
			Alert.alert("Error", "Please select a size");
			return;
		}

		if (!newExternalProduct.assigned_internal_product) {
			Alert.alert(
				"Error",
				"Please assign this external product to an internal product",
			);
			return;
		}

		if (newExternalProduct.quantity < 0) {
			Alert.alert("Error", "Please enter a valid quantity");
			return;
		}

		setIsSubmittingExternal(true);
		try {
			// 1. Add the external product to external_products sheet
			const externalProductForSheet = {
				unique_id_sku: newExternalProduct.unique_id_sku,
				manufacturer_color: newExternalProduct.manufacturer_color,
				brand: newExternalProduct.brand,
				size: newExternalProduct.size,
				bag_quantity: newExternalProduct.bag_quantity,
				distributors: newExternalProduct.distributors.join(", ") || "",
				quantity: newExternalProduct.quantity,
			};

			const addResult = await addExternalProduct(externalProductForSheet);
			if (!addResult.success) {
				Alert.alert(
					"Error",
					addResult.error || "Failed to add external product",
				);
				return;
			}

			// 2. Update the assigned internal product to include this SKU
			const assignedInternalProduct = internalProducts.find(
				(p) =>
					p.sparkys_product_name ===
					newExternalProduct.assigned_internal_product,
			);

			let linkingSucceeded = false;
			let updatedInternalProduct: InternalProduct | undefined;

			if (assignedInternalProduct) {
				updatedInternalProduct = {
					...assignedInternalProduct,
					products: [
						...assignedInternalProduct.products,
						newExternalProduct.unique_id_sku,
					],
				};

				// Convert to sheet format for updating
				const internalProductForSheet = {
					id: updatedInternalProduct.id,
					sparkys_product_name: updatedInternalProduct.sparkys_product_name,
					product_type: updatedInternalProduct.product_type,
					sparkys_color: updatedInternalProduct.sparkys_color,
					texture: updatedInternalProduct.texture,
					shape: updatedInternalProduct.shape,
					occasions: updatedInternalProduct.occasions.join(", "),
					products: updatedInternalProduct.products.join(", "),
					threshold_quantity: updatedInternalProduct.threshold_quantity,
					never_out: updatedInternalProduct.never_out,
					status: updatedInternalProduct.status,
				};

				const updateResult = await updateInternalProduct(
					internalProductForSheet,
				);
				if (!updateResult.success) {
					logger.warn(
						"Inventory",
						"Failed to link external product to internal product:",
						updateResult.error,
					);
					// Don't return - continue with success since external product was created
				} else {
					linkingSucceeded = true;
				}
			}

			// Add external product to store immediately
			const newExternal = {
				unique_id_sku: newExternalProduct.unique_id_sku,
				manufacturer_color: newExternalProduct.manufacturer_color,
				brand: newExternalProduct.brand,
				size: newExternalProduct.size,
				bag_quantity: newExternalProduct.bag_quantity,
				distributors: newExternalProduct.distributors,
				quantity: newExternalProduct.quantity,
				status: "active" as const,
			};
			addExternalProductToStore(newExternal);

			// Update internal product in store if it was linked
			if (assignedInternalProduct && updatedInternalProduct) {
				updateInternalProductInStore(
					assignedInternalProduct.id,
					updatedInternalProduct,
				);
			}

			setIsAddModalVisible(false);
			resetNewProductForm();

			if (linkingSucceeded || !assignedInternalProduct) {
				Alert.alert(
					"Success",
					`External product "${newExternalProduct.unique_id_sku}" added and assigned to "${newExternalProduct.assigned_internal_product}"!`,
				);
			} else {
				Alert.alert(
					"Partial Success",
					`External product "${newExternalProduct.unique_id_sku}" was created but failed to link to "${newExternalProduct.assigned_internal_product}". You may need to link it manually.`,
				);
			}
		} catch (error) {
			logger.error("Inventory", "Failed to add external product", { error });
			Alert.alert("Error", "Failed to add external product to spreadsheet");
		} finally {
			setIsSubmittingExternal(false);
		}
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
			edges={["top", "bottom"]}
		>
			<View
				style={[
					styles.headerContainer,
					{
						backgroundColor: colors.cardBackground,
						borderBottomColor: colors.borderLight,
					},
				]}
			>
				<Pressable
					onPress={() => setIsViewDropdownVisible(!isViewDropdownVisible)}
					style={styles.titleButton}
				>
					<Text style={[styles.title, { color: colors.text }]}>
						{currentViewLabel}
					</Text>
					<Ionicons
						name={isViewDropdownVisible ? "chevron-up" : "chevron-down"}
						size={20}
						color={colors.text}
					/>
				</Pressable>
				<View style={styles.headerActions}>
					{currentView === "products" && (
						<Pressable
							onPress={handleAddInternalProduct}
							style={styles.addButton}
						>
							<Ionicons name="add" size={24} color="white" />
						</Pressable>
					)}
					<Pressable onPress={handleAddButtonPress} style={styles.addButton}>
						<Ionicons
							name={currentView === "products" ? "barcode-outline" : "add"}
							size={24}
							color="white"
						/>
					</Pressable>
					{currentView === "products" && (
						<View style={styles.filterButtonContainer}>
							<Pressable
								onPress={() => setIsFilterModalVisible(true)}
								style={styles.addButton}
							>
								<Ionicons name="options-outline" size={24} color="white" />
							</Pressable>
							{totalSelections > 0 && (
								<View style={styles.filterBadge}>
									<Text style={styles.filterBadgeText}>{totalSelections}</Text>
								</View>
							)}
						</View>
					)}
					{currentView !== "products" && (
						<View style={styles.filterButtonContainer}>
							<Pressable
								onPress={() => setIsMetadataFilterModalVisible(true)}
								style={styles.addButton}
							>
								<Ionicons name="options-outline" size={24} color="white" />
							</Pressable>
							{metadataShowArchived && (
								<View style={styles.filterBadge}>
									<Text style={styles.filterBadgeText}>1</Text>
								</View>
							)}
						</View>
					)}
					<AvatarDropdown />
				</View>
			</View>

			{isViewDropdownVisible && (
				<View
					style={[
						styles.dropdown,
						{
							backgroundColor: colors.cardBackground,
							borderBottomColor: colors.borderLight,
						},
					]}
				>
					{VIEW_OPTIONS.map((option) => (
						<Pressable
							key={option.key}
							onPress={() => handleViewChange(option.key)}
							style={[
								styles.dropdownItem,
								{ borderBottomColor: colors.separator },
								currentView === option.key && {
									backgroundColor: colors.surface,
								},
							]}
						>
							<Text
								style={[
									styles.dropdownText,
									{ color: colors.textSecondary },
									currentView === option.key && {
										color: colors.primary,
										fontWeight: "600",
									},
								]}
							>
								{option.label}
							</Text>
						</Pressable>
					))}
				</View>
			)}

			<View
				style={[
					styles.contentContainer,
					{ backgroundColor: colors.background },
				]}
			>
				{sheetsRefreshing && (
					<View
						style={[
							styles.loadingContainer,
							{
								backgroundColor: colors.surface,
								borderBottomColor: colors.borderLight,
							},
						]}
					>
						<ActivityIndicator size="small" color={colors.primary} />
						<Text style={[styles.loadingText, { color: colors.textSecondary }]}>
							Loading data...
						</Text>
					</View>
				)}

				{sheetsError && (
					<View
						style={[styles.errorContainer, { backgroundColor: colors.surface }]}
					>
						<Text style={[styles.errorText, { color: colors.error }]}>
							{sheetsError}
						</Text>
						<Pressable
							onPress={refresh}
							style={[styles.retryButton, { backgroundColor: colors.primary }]}
						>
							<Text style={styles.retryButtonText}>Retry</Text>
						</Pressable>
					</View>
				)}

				<InfiniteScroll
					data={currentData}
					renderItem={currentRenderItem}
					keyExtractor={currentKeyExtractor}
					onRefresh={refresh}
					refreshing={sheetsRefreshing}
				/>
			</View>

			<Modal
				visible={isFilterModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsFilterModalVisible(false)}
			>
				<View
					style={[
						styles.modalContainer,
						{ backgroundColor: colors.background },
					]}
				>
					<View
						style={[
							styles.modalHeader,
							{
								backgroundColor: colors.cardBackground,
								borderBottomColor: colors.borderLight,
							},
						]}
					>
						<Text style={[styles.modalTitle, { color: colors.text }]}>
							Filter Inventory
						</Text>
						<View style={styles.modalHeaderActions}>
							{totalSelections > 0 && (
								<Pressable
									onPress={clearAllFilters}
									style={[
										styles.clearButton,
										{ backgroundColor: colors.error },
									]}
								>
									<Text style={styles.clearText}>Clear All</Text>
								</Pressable>
							)}
							<Pressable
								onPress={() => setIsFilterModalVisible(false)}
								style={[
									styles.closeButton,
									{ backgroundColor: colors.surface },
								]}
							>
								<Ionicons name="close" size={24} color={colors.textSecondary} />
							</Pressable>
						</View>
					</View>

					<ScrollView
						style={styles.modalScrollView}
						showsVerticalScrollIndicator={false}
					>
						{/* Internal Product Filters */}
						<Text style={[styles.filterSectionTitle, { color: colors.text }]}>
							Sparky's
						</Text>

						{/* Understocked Filter */}
						<View
							style={[
								styles.filterSection,
								{ backgroundColor: colors.cardBackground },
							]}
						>
							<Pressable
								style={[
									styles.filterHeader,
									{ backgroundColor: colors.cardBackground },
								]}
								onPress={() =>
									setInternalFilters((prev) => ({
										...prev,
										understocked: !prev.understocked,
									}))
								}
							>
								<View style={styles.understockedHeader}>
									<Ionicons
										name="alert-circle-outline"
										size={20}
										color={
											internalFilters.understocked ? colors.error : colors.icon
										}
									/>
									<Text
										style={[
											styles.filterHeaderText,
											{
												color: internalFilters.understocked
													? colors.error
													: colors.text,
											},
										]}
									>
										Understocked Items
									</Text>
								</View>
								<View
									style={[
										styles.toggleSwitch,
										{
											backgroundColor: internalFilters.understocked
												? colors.error
												: colors.surface,
										},
									]}
								>
									<View
										style={[
											styles.toggleThumb,
											{
												backgroundColor: "white",
												transform: [
													{ translateX: internalFilters.understocked ? 18 : 2 },
												],
											},
										]}
									/>
								</View>
							</Pressable>
						</View>

						{/* Show Archived Filter */}
						<View
							style={[
								styles.filterSection,
								{ backgroundColor: colors.cardBackground },
							]}
						>
							<Pressable
								style={[
									styles.filterHeader,
									{ backgroundColor: colors.cardBackground },
								]}
								onPress={() =>
									setInternalFilters((prev) => ({
										...prev,
										showArchived: !prev.showArchived,
									}))
								}
							>
								<View style={styles.understockedHeader}>
									<Ionicons
										name="archive-outline"
										size={20}
										color={
											internalFilters.showArchived
												? colors.primary
												: colors.icon
										}
									/>
									<Text
										style={[
											styles.filterHeaderText,
											{
												color: internalFilters.showArchived
													? colors.primary
													: colors.text,
											},
										]}
									>
										Show Archived Items
									</Text>
								</View>
								<View
									style={[
										styles.toggleSwitch,
										{
											backgroundColor: internalFilters.showArchived
												? colors.primary
												: colors.surface,
										},
									]}
								>
									<View
										style={[
											styles.toggleThumb,
											{
												backgroundColor: "white",
												transform: [
													{ translateX: internalFilters.showArchived ? 18 : 2 },
												],
											},
										]}
									/>
								</View>
							</Pressable>
						</View>

						{Object.entries({
							product_type: "productType",
							sparkys_color: "sparkys_color",
							texture: "texture",
							shape: "shape",
							occasions: "occasion",
						}).map(([category, fieldKey]) => (
							<CollapsibleFilterSection
								key={category}
								title={formatCategoryTitle(category)}
								options={getAllMetadataItems(
									fieldKey,
									internalFilters.showArchived,
								)}
								selectedValues={
									/* istanbul ignore next -- every internal array-filter key is initialized in defaultInternalFilters, so the [] fallback is unreachable */
									internalFilters[category as InternalArrayFilterKey] || []
								}
								onSelectionChange={(values) =>
									handleInternalFilterChange(
										category as keyof InternalFilters,
										values,
									)
								}
							/>
						))}

						{/* External Product Filters */}
						<Text style={[styles.filterSectionTitle, { color: colors.text }]}>
							Manufacturers'
						</Text>

						{/* Show Archived Filter for External */}
						<View
							style={[
								styles.filterSection,
								{ backgroundColor: colors.cardBackground },
							]}
						>
							<Pressable
								style={[
									styles.filterHeader,
									{ backgroundColor: colors.cardBackground },
								]}
								onPress={() =>
									setExternalFilters((prev) => ({
										...prev,
										showArchived: !prev.showArchived,
									}))
								}
							>
								<View style={styles.understockedHeader}>
									<Ionicons
										name="archive-outline"
										size={20}
										color={
											externalFilters.showArchived
												? colors.primary
												: colors.icon
										}
									/>
									<Text
										style={[
											styles.filterHeaderText,
											{
												color: externalFilters.showArchived
													? colors.primary
													: colors.text,
											},
										]}
									>
										Show Archived Items
									</Text>
								</View>
								<View
									style={[
										styles.toggleSwitch,
										{
											backgroundColor: externalFilters.showArchived
												? colors.primary
												: colors.surface,
										},
									]}
								>
									<View
										style={[
											styles.toggleThumb,
											{
												backgroundColor: "white",
												transform: [
													{ translateX: externalFilters.showArchived ? 18 : 2 },
												],
											},
										]}
									/>
								</View>
							</Pressable>
						</View>

						{Object.entries({
							manufacturer_color: "manufacturer_color",
							brand: "manufacturer",
							size: "size",
							distributors: "distributor",
						}).map(([category, fieldKey]) => (
							<CollapsibleFilterSection
								key={category}
								title={formatCategoryTitle(category)}
								options={getAllMetadataItems(
									fieldKey,
									externalFilters.showArchived,
								)}
								selectedValues={
									/* istanbul ignore next -- every external array-filter key is initialized in defaultExternalFilters, so the [] fallback is unreachable */
									externalFilters[category as ExternalArrayFilterKey] || []
								}
								onSelectionChange={(values) =>
									handleExternalFilterChange(
										category as keyof ExternalFilters,
										values,
									)
								}
							/>
						))}
					</ScrollView>
				</View>
			</Modal>

			<Modal
				visible={isAddModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsAddModalVisible(false)}
			>
				<View
					style={[
						styles.modalContainer,
						{ backgroundColor: colors.background },
					]}
				>
					<View
						style={[
							styles.modalHeader,
							{
								backgroundColor: colors.cardBackground,
								borderBottomColor: colors.borderLight,
							},
						]}
					>
						<Text style={[styles.modalTitle, { color: colors.text }]}>
							{currentView === "products"
								? "Add New Product"
								: `Add New ${currentViewLabel.slice(0, -1)}`}
						</Text>
						<View style={styles.modalHeaderActions}>
							<Pressable
								onPress={() => {
									if (currentView === "products") {
										if (scannedBarcode) {
											handleAddExternalProductSubmit();
										} else {
											handleAddInternalProductSubmit();
										}
									} else {
										handleAddMetadata();
									}
								}}
								style={[
									styles.saveButton,
									{ backgroundColor: colors.primary },
									((scannedBarcode && isSubmittingExternal) ||
										(currentView !== "products" && isSubmittingMetadata) ||
										(!scannedBarcode &&
											currentView === "products" &&
											isSubmittingInternal)) && {
										opacity: 0.6,
									},
								]}
								disabled={
									(!!scannedBarcode && isSubmittingExternal) ||
									(currentView !== "products" && isSubmittingMetadata) ||
									(!scannedBarcode &&
										currentView === "products" &&
										isSubmittingInternal)
								}
							>
								{(scannedBarcode && isSubmittingExternal) ||
								(currentView !== "products" && isSubmittingMetadata) ||
								(!scannedBarcode &&
									currentView === "products" &&
									isSubmittingInternal) ? (
									<Ionicons name="hourglass" size={24} color="white" />
								) : (
									<Ionicons name="checkmark" size={24} color="white" />
								)}
							</Pressable>
							<Pressable
								onPress={() => {
									setIsAddModalVisible(false);
									resetNewProductForm();
								}}
								style={[
									styles.closeButton,
									{ backgroundColor: colors.surface },
								]}
							>
								<Ionicons name="close" size={24} color={colors.textSecondary} />
							</Pressable>
						</View>
					</View>

					<ScrollView
						style={styles.formScrollView}
						showsVerticalScrollIndicator={false}
					>
						{currentView === "products" ? (
							<View style={styles.formSection}>
								{scannedBarcode ? (
									// External Product Form
									<>
										{/* Primary Info Section */}
										<View style={styles.inputGroup}>
											<Text style={[styles.inputLabel, { color: colors.text }]}>
												Barcode (SKU)
											</Text>
											<TextInput
												style={[
													styles.textInput,
													styles.disabledInput,
													{
														backgroundColor: colors.surface,
														borderColor: colors.border,
														color: colors.textSecondary,
													},
												]}
												value={newExternalProduct.unique_id_sku}
												placeholder="Scanned barcode"
												placeholderTextColor={colors.textSecondary}
												editable={false}
											/>
										</View>

										<CollapsibleRadioSection
											title="Assign to Internal Product"
											options={internalProducts.map(
												(p) => p.sparkys_product_name,
											)}
											selectedValue={
												newExternalProduct.assigned_internal_product || ""
											}
											onSelectionChange={(productName) =>
												setNewExternalProduct((prev) => ({
													...prev,
													assigned_internal_product: productName,
												}))
											}
										/>

										{/* Separator */}
										<View
											style={[
												styles.sectionSeparator,
												{ backgroundColor: colors.border },
											]}
										/>

										{/* Product Details Section */}
										<CollapsibleRadioSection
											title="Manufacturer Color"
											options={PRODUCT_FIELD_OPTIONS.manufacturer_color || []}
											selectedValue={newExternalProduct.manufacturer_color}
											onSelectionChange={(color) =>
												setNewExternalProduct((prev) => ({
													...prev,
													manufacturer_color: color,
												}))
											}
										/>

										<CollapsibleRadioSection
											title="Brand"
											options={PRODUCT_FIELD_OPTIONS.manufacturer || []}
											selectedValue={newExternalProduct.brand}
											onSelectionChange={(brand) =>
												setNewExternalProduct((prev) => ({ ...prev, brand }))
											}
										/>

										<CollapsibleRadioSection
											title="Size"
											options={PRODUCT_FIELD_OPTIONS.size || []}
											selectedValue={newExternalProduct.size}
											onSelectionChange={(size) =>
												setNewExternalProduct((prev) => ({ ...prev, size }))
											}
										/>

										{/* Quantity Fields on Same Line */}
										<View style={styles.quantityRow}>
											<View style={styles.quantityField}>
												<Text
													style={[styles.inputLabel, { color: colors.text }]}
												>
													Bag Quantity
												</Text>
												<TextInput
													style={[
														styles.textInput,
														{
															backgroundColor: colors.surface,
															borderColor: colors.border,
															color: colors.text,
														},
													]}
													value={newExternalProduct.bag_quantity.toString()}
													onChangeText={(text) =>
														setNewExternalProduct((prev) => ({
															...prev,
															bag_quantity: parseInt(text, 10) || 0,
														}))
													}
													placeholder="50"
													placeholderTextColor={colors.textSecondary}
													keyboardType="numeric"
												/>
											</View>

											<View style={styles.quantityField}>
												<Text
													style={[styles.inputLabel, { color: colors.text }]}
												>
													Current Quantity
												</Text>
												<TextInput
													style={[
														styles.textInput,
														{
															backgroundColor: colors.surface,
															borderColor: colors.border,
															color: colors.text,
														},
													]}
													value={newExternalProduct.quantity.toString()}
													onChangeText={(text) =>
														setNewExternalProduct((prev) => ({
															...prev,
															quantity: parseInt(text, 10) || 0,
														}))
													}
													placeholder="0"
													placeholderTextColor={colors.textSecondary}
													keyboardType="numeric"
												/>
											</View>
										</View>
									</>
								) : (
									// Internal Product Form
									<>
										<View style={styles.nameRow}>
											<View style={styles.nameContainer}>
												<TextInput
													style={[
														styles.nameInput,
														{
															backgroundColor: colors.surface,
															borderColor: colors.border,
															color: colors.text,
														},
													]}
													value={newInternalProduct.sparkys_product_name}
													onChangeText={(text) =>
														setNewInternalProduct((prev) => ({
															...prev,
															sparkys_product_name: text,
														}))
													}
													placeholder="Product Name..."
													placeholderTextColor={colors.textSecondary}
													autoFocus
												/>
											</View>
											<Pressable
												style={[
													styles.neverOutToggleBadge,
													newInternalProduct.never_out
														? styles.neverOutToggleActive
														: styles.neverOutToggleInactive,
												]}
												onPress={() =>
													setNewInternalProduct((prev) => ({
														...prev,
														never_out: !prev.never_out,
													}))
												}
											>
												<Text
													style={[
														styles.neverOutToggleText,
														newInternalProduct.never_out
															? styles.neverOutToggleTextActive
															: styles.neverOutToggleTextInactive,
													]}
												>
													Never Out
												</Text>
											</Pressable>
										</View>

										<View style={styles.quantityRow}>
											<View
												style={[
													styles.quantityBox,
													{ backgroundColor: colors.surface },
												]}
											>
												<Text
													style={[
														styles.quantityLabel,
														{ color: colors.textSecondary },
													]}
												>
													Total Quantity
												</Text>
												<Text style={[styles.quantity, { color: colors.text }]}>
													0
												</Text>
											</View>
											<View
												style={[
													styles.quantityBox,
													{ backgroundColor: colors.surface },
												]}
											>
												<Text
													style={[
														styles.quantityLabel,
														{ color: colors.textSecondary },
													]}
												>
													Threshold Quantity
												</Text>
												<TextInput
													style={[
														styles.thresholdInput,
														{
															backgroundColor: colors.cardBackground,
															borderColor: colors.border,
															color: colors.primary,
														},
													]}
													value={(
														newInternalProduct.threshold_quantity || 0
													).toString()}
													onChangeText={(text) => {
														const threshold = parseInt(text, 10);
														setNewInternalProduct((prev) => ({
															...prev,
															threshold_quantity: Number.isNaN(threshold)
																? 0
																: threshold,
														}));
													}}
													placeholder="0"
													placeholderTextColor={colors.textSecondary}
													keyboardType="numeric"
													selectTextOnFocus
												/>
											</View>
										</View>

										<CollapsibleRadioSection
											title="Product Type"
											options={PRODUCT_FIELD_OPTIONS.productType || []}
											selectedValue={newInternalProduct.product_type}
											onSelectionChange={(type) =>
												setNewInternalProduct((prev) => ({
													...prev,
													product_type: type,
												}))
											}
										/>

										<CollapsibleRadioSection
											title="Sparky's Color"
											options={PRODUCT_FIELD_OPTIONS.sparkys_color || []}
											selectedValue={newInternalProduct.sparkys_color}
											onSelectionChange={(color) =>
												setNewInternalProduct((prev) => ({
													...prev,
													sparkys_color: color,
												}))
											}
										/>

										<CollapsibleRadioSection
											title="Texture"
											options={PRODUCT_FIELD_OPTIONS.texture || []}
											selectedValue={newInternalProduct.texture}
											onSelectionChange={(texture) =>
												setNewInternalProduct((prev) => ({ ...prev, texture }))
											}
										/>

										<CollapsibleRadioSection
											title="Shape"
											options={PRODUCT_FIELD_OPTIONS.shape || []}
											selectedValue={newInternalProduct.shape}
											onSelectionChange={(shape) =>
												setNewInternalProduct((prev) => ({ ...prev, shape }))
											}
										/>

										<CollapsibleMultiSelectSection
											title="Occasions"
											options={PRODUCT_FIELD_OPTIONS.occasion || []}
											selectedValues={
												/* istanbul ignore next -- occasions is always an array in form state, so the [] fallback is unreachable */
												newInternalProduct.occasions || []
											}
											onSelectionChange={(occasions) =>
												setNewInternalProduct((prev) => ({
													...prev,
													occasions,
												}))
											}
										/>
									</>
								)}
							</View>
						) : (
							<View style={styles.formSection}>
								<Text style={[styles.sectionTitle, { color: colors.text }]}>
									Add New Value
								</Text>

								<View style={styles.inputGroup}>
									<Text style={[styles.inputLabel, { color: colors.text }]}>
										{currentViewLabel.slice(0, -1)} Name
									</Text>
									<TextInput
										style={[
											styles.textInput,
											{
												backgroundColor: colors.surface,
												borderColor: colors.border,
												color: colors.text,
											},
										]}
										value={newMetadataValue}
										onChangeText={setNewMetadataValue}
										placeholder={`Enter ${currentViewLabel.slice(0, -1).toLowerCase()} name`}
										placeholderTextColor={colors.textSecondary}
										autoFocus
									/>
								</View>
							</View>
						)}
					</ScrollView>
				</View>
			</Modal>

			<Modal
				visible={isMetadataFilterModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsMetadataFilterModalVisible(false)}
			>
				<View
					style={[
						styles.modalContainer,
						{ backgroundColor: colors.background },
					]}
				>
					<View
						style={[
							styles.modalHeader,
							{
								backgroundColor: colors.cardBackground,
								borderBottomColor: colors.borderLight,
							},
						]}
					>
						<Text style={[styles.modalTitle, { color: colors.text }]}>
							Filter{" "}
							{currentView.charAt(0).toUpperCase() + currentView.slice(1)}
						</Text>
						<View style={styles.modalHeaderActions}>
							{metadataShowArchived && (
								<Pressable
									onPress={() => setMetadataShowArchived(false)}
									style={[
										styles.clearButton,
										{ backgroundColor: colors.error },
									]}
								>
									<Text style={styles.clearText}>Clear All</Text>
								</Pressable>
							)}
							<Pressable
								onPress={() => setIsMetadataFilterModalVisible(false)}
								style={[
									styles.closeButton,
									{ backgroundColor: colors.surface },
								]}
							>
								<Ionicons name="close" size={24} color={colors.textSecondary} />
							</Pressable>
						</View>
					</View>

					<ScrollView
						style={styles.modalScrollView}
						showsVerticalScrollIndicator={false}
					>
						{/* Show Archived Filter */}
						<View
							style={[
								styles.filterSection,
								{ backgroundColor: colors.cardBackground },
							]}
						>
							<Pressable
								style={[
									styles.filterHeader,
									{ backgroundColor: colors.cardBackground },
								]}
								onPress={() => setMetadataShowArchived(!metadataShowArchived)}
							>
								<View style={styles.understockedHeader}>
									<Ionicons
										name="archive-outline"
										size={20}
										color={metadataShowArchived ? colors.primary : colors.icon}
									/>
									<Text
										style={[
											styles.filterHeaderText,
											{
												color: metadataShowArchived
													? colors.primary
													: colors.text,
											},
										]}
									>
										Show Archived Items
									</Text>
								</View>
								<View
									style={[
										styles.toggleSwitch,
										{
											backgroundColor: metadataShowArchived
												? colors.primary
												: colors.surface,
										},
									]}
								>
									<View
										style={[
											styles.toggleThumb,
											{
												backgroundColor: metadataShowArchived
													? "white"
													: colors.textSecondary,
												transform: [
													{
														translateX: metadataShowArchived ? 20 : 2,
													},
												],
											},
										]}
									/>
								</View>
							</Pressable>
						</View>
					</ScrollView>
				</View>
			</Modal>

			<Modal
				visible={isScannerVisible}
				animationType="slide"
				presentationStyle="fullScreen"
				onRequestClose={() => setIsScannerVisible(false)}
			>
				<SafeAreaView
					style={[
						styles.scannerContainer,
						{ backgroundColor: colors.cardBackground },
					]}
				>
					<View
						style={[
							styles.scannerHeader,
							{ backgroundColor: colors.cardBackground },
						]}
					>
						<Text style={[styles.scannerTitle, { color: colors.text }]}>
							Scan Barcode
						</Text>
						<Pressable
							onPress={() => setIsScannerVisible(false)}
							style={[styles.closeButton, { backgroundColor: colors.surface }]}
						>
							<Ionicons name="close" size={24} color={colors.text} />
						</Pressable>
					</View>
					<CameraView
						style={styles.camera}
						barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
						onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
						onMountError={(event) =>
							logger.error("Inventory", "Camera failed to mount", { event })
						}
					/>
				</SafeAreaView>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	contentContainer: {
		flex: 1,
	},
	headerContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	titleButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	dropdown: {
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	dropdownItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f1f3f4",
	},
	dropdownItemActive: {
		backgroundColor: "#f8f9fa",
	},
	dropdownText: {
		fontSize: 16,
		color: "#495057",
	},
	dropdownTextActive: {
		color: "#007bff",
		fontWeight: "600",
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	filterButtonContainer: {
		position: "relative",
	},
	addButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#007bff",
		justifyContent: "center",
		alignItems: "center",
	},
	filterButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#f8f9fa",
		borderWidth: 1,
		borderColor: "#dee2e6",
		justifyContent: "center",
		alignItems: "center",
	},
	filterBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		backgroundColor: "#ff4757",
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 1,
	},
	filterBadgeText: {
		color: "white",
		fontSize: 12,
		fontWeight: "bold",
	},
	modalContainer: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	modalHeaderActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	clearButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: "#ff4757",
	},
	clearText: {
		color: "white",
		fontSize: 12,
		fontWeight: "600",
	},
	saveButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#007bff",
		justifyContent: "center",
		alignItems: "center",
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	modalScrollView: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 32,
	},
	filterSection: {
		backgroundColor: "white",
		marginBottom: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		overflow: "hidden",
	},
	filterHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	filterHeaderText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
	},
	pillContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
	},
	pillSelected: {
		backgroundColor: "#007bff",
		borderColor: "#007bff",
	},
	pillTextSelected: {
		color: "white",
		fontWeight: "600",
	},
	expandPill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#6c757d",
		backgroundColor: "white",
		margin: 4,
		borderStyle: "dashed",
	},
	expandText: {
		color: "#6c757d",
		fontSize: 14,
		fontWeight: "500",
	},
	card: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 16,
		marginVertical: 8,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 12,
	},
	productName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
		marginRight: 12,
	},
	price: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#007bff",
	},
	metadataGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 4,
	},
	metadataItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		flex: 0,
		minWidth: "30%",
		maxWidth: "32%",
		gap: 4,
	},
	metadataValue: {
		fontSize: 11,
		color: "#495057",
		fontWeight: "500",
		flex: 1,
	},
	metadataItemSelected: {
		backgroundColor: "#e3f2fd",
		borderWidth: 1,
		borderColor: "#007bff",
	},
	metadataValueSelected: {
		color: "#007bff",
		fontWeight: "600",
	},
	formScrollView: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
	},
	formSection: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginBottom: 16,
	},
	inputGroup: {
		marginBottom: 16,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#495057",
		marginBottom: 8,
	},
	textInput: {
		borderWidth: 1,
		borderColor: "#dee2e6",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		backgroundColor: "white",
		color: "#495057",
	},
	disabledInput: {
		backgroundColor: "#f8f9fa",
		color: "#6c757d",
	},
	optionScroll: {
		flexGrow: 0,
	},
	optionButton: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		marginRight: 8,
		marginBottom: 8,
	},
	optionButtonSelected: {
		backgroundColor: "#007bff",
		borderColor: "#007bff",
	},
	optionButtonText: {
		color: "#495057",
		fontSize: 14,
		fontWeight: "500",
	},
	optionButtonTextSelected: {
		color: "white",
		fontWeight: "600",
	},
	scannerContainer: {
		flex: 1,
		backgroundColor: "#000",
	},
	scannerHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderBottomWidth: 1,
	},
	scannerTitle: {
		fontSize: 20,
		fontWeight: "bold",
	},
	camera: {
		flex: 1,
	},
	loadingContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
		backgroundColor: "#f8f9fa",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	loadingText: {
		marginLeft: 8,
		fontSize: 14,
		color: "#6c757d",
	},
	errorContainer: {
		padding: 16,
		backgroundColor: "#f8d7da",
		borderBottomWidth: 1,
		borderBottomColor: "#f5c2c7",
		alignItems: "center",
	},
	errorText: {
		fontSize: 14,
		color: "#721c24",
		textAlign: "center",
		marginBottom: 8,
	},
	retryButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		backgroundColor: "#dc3545",
		borderRadius: 6,
	},
	retryButtonText: {
		color: "white",
		fontSize: 14,
		fontWeight: "600",
	},
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		margin: 4,
	},
	pillText: {
		color: "#495057",
		fontSize: 14,
		fontWeight: "500",
	},
	filterSectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginTop: 16,
		marginBottom: 16,
		marginLeft: 16,
	},
	instructions: {
		fontSize: 14,
		color: "#6c757d",
		marginBottom: 16,
		fontStyle: "italic",
	},
	comingSoon: {
		fontSize: 16,
		color: "#6c757d",
		textAlign: "center",
		marginVertical: 32,
		fontStyle: "italic",
		lineHeight: 24,
	},
	understockedHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
	},
	toggleSwitch: {
		width: 44,
		height: 24,
		borderRadius: 12,
		justifyContent: "center",
		position: "relative",
	},
	toggleThumb: {
		width: 20,
		height: 20,
		borderRadius: 10,
		position: "absolute",
	},
	sectionSeparator: {
		height: 1,
		backgroundColor: "#dee2e6",
		marginVertical: 20,
		marginHorizontal: 4,
	},
	quantityRow: {
		flexDirection: "row",
		gap: 16,
	},
	quantityField: {
		flex: 1,
	},
	expandedContent: {
		padding: 16,
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		marginBottom: 16,
		backgroundColor: "white",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#dee2e6",
		gap: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 14,
		color: "#1a1a1a",
		paddingVertical: 0,
	},
	noResultsText: {
		fontSize: 14,
		color: "#6c757d",
		fontStyle: "italic",
		textAlign: "center",
		width: "100%",
		paddingVertical: 20,
	},
	toggleContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "#dee2e6",
		padding: 4,
		minHeight: 48,
		position: "relative",
	},
	toggleLabel: {
		fontSize: 14,
		fontWeight: "600",
		paddingLeft: 28,
		paddingRight: 12,
	},
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	nameContainer: {
		flex: 1,
	},
	nameInput: {
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 12,
		fontSize: 18,
		fontWeight: "600",
		minHeight: 48,
	},
	quantityBox: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		marginBottom: 16,
	},
	quantityLabel: {
		fontSize: 12,
		fontWeight: "600",
		marginBottom: 4,
	},
	quantity: {
		fontSize: 24,
		fontWeight: "bold",
		minWidth: 60,
		textAlign: "left",
	},
	thresholdInput: {
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
		fontSize: 24,
		fontWeight: "bold",
		minWidth: 60,
		textAlign: "center",
	},
	neverOutToggleBadge: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 16,
		alignSelf: "center",
	},
	neverOutToggleActive: {
		backgroundColor: "#c026d3",
		borderWidth: 2,
		borderColor: "#c026d3",
	},
	neverOutToggleInactive: {
		backgroundColor: "transparent",
		borderWidth: 2,
		borderColor: "#c026d3",
		borderStyle: "dashed",
	},
	neverOutToggleText: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
	},
	neverOutToggleTextActive: {
		color: "white",
	},
	neverOutToggleTextInactive: {
		color: "#9ca3af",
	},
});
