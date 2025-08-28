import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import InternalProductCard from "@/components/InternalProductCard";
import Pagination from "@/components/Pagination";
import PillCheckbox from "@/components/PillCheckbox";
import { Colors } from "@/constants/Colors";
import {
	type ExternalProduct,
	type InternalProduct,
	PRODUCT_FIELD_OPTIONS,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import {
	getAllExternalProducts,
	getAllInternalProducts,
	getExternalProductBySku,
} from "@/store/products";

type ViewMode =
	| "products" // Internal products (hierarchical view)
	| "productTypes"
	| "colors"
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
	{ key: "colors" as ViewMode, label: "Colors" },
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
};

type ExternalFilters = {
	manufacturer_color: string[];
	brand: string[];
	size: string[];
	distributors: string[];
};

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
	const { theme } = useTheme();
	const colors = Colors[theme];

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	}

	function handlePillPress(value: string): void {
		const newSelection = selectedValues.includes(value)
			? selectedValues.filter((v) => v !== value)
			: [...selectedValues, value];
		onSelectionChange(newSelection);
	}

	const displayOptions = isExpanded
		? options
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
					{!isExpanded && hasSelections && (
						<Pressable
							style={[
								styles.expandPill,
								{ backgroundColor: colors.surface, borderColor: colors.border },
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
			)}
		</View>
	);
}

function ProductCard({
	item,
	filters,
	onFilterToggle,
}: {
	item: Product;
	filters: FieldFilters;
	onFilterToggle: (field: Field, value: string) => void;
}) {
	const product = item;
	const { theme } = useTheme();
	const colors = Colors[theme];

	const getIconForMetadata = (field: string): string => {
		switch (field) {
			case "productType":
				return "shapes-outline";
			case "color":
				return "color-palette-outline";
			case "manufacturer":
				return "business-outline";
			case "size":
				return "resize-outline";
			case "texture":
				return "hand-left-outline";
			case "bagQuantity":
				return "bag-outline";
			case "shape":
				return "diamond-outline";
			case "distributor":
				return "storefront-outline";
			case "occasion":
				return "calendar-outline";
			default:
				return "information-circle-outline";
		}
	};

	const metadataItems = [
		{
			field: "productType",
			value: product.productType,
			icon: getIconForMetadata("productType"),
		},
		{ field: "color", value: product.color, icon: getIconForMetadata("color") },
		{
			field: "manufacturer",
			value: product.manufacturer,
			icon: getIconForMetadata("manufacturer"),
		},
		{ field: "size", value: product.size, icon: getIconForMetadata("size") },
		{
			field: "texture",
			value: product.texture,
			icon: getIconForMetadata("texture"),
		},
		{
			field: "bagQuantity",
			value: product.bagQuantity?.toString(),
			icon: getIconForMetadata("bagQuantity"),
		},
		{ field: "shape", value: product.shape, icon: getIconForMetadata("shape") },
		{
			field: "distributor",
			value: product.distributor,
			icon: getIconForMetadata("distributor"),
		},
		{
			field: "occasion",
			value: product.occasion,
			icon: getIconForMetadata("occasion"),
		},
	].filter((item) => item.value && item.value.trim() !== "");

	const isMetadataSelected = (field: string, value: string): boolean => {
		const fieldFilters = filters[field as Field];
		return fieldFilters ? fieldFilters.includes(value) : false;
	};

	const handleMetadataPress = (field: string, value: string) => {
		onFilterToggle(field as Field, value);
	};

	return (
		<View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
			<Pressable
				style={styles.cardHeader}
				onPress={() => router.push(`/product/${product.id}`)}
			>
				<Text style={[styles.productName, { color: colors.text }]}>
					{product.name}
				</Text>
				<Text style={[styles.price, { color: colors.primary }]}>
					{product.quantity}
				</Text>
			</Pressable>

			<View style={styles.metadataGrid}>
				{metadataItems.map((item) => {
					const isSelected = isMetadataSelected(item.field, item.value!);
					return (
						<Pressable
							key={item.field}
							style={[
								styles.metadataItem,
								{ backgroundColor: colors.metadataBackground },
								isSelected && {
									backgroundColor: colors.selectedBackground,
									borderColor: colors.primary,
								},
							]}
							onPress={() => handleMetadataPress(item.field, item.value!)}
						>
							<Ionicons
								name={item.icon as any}
								size={16}
								color={isSelected ? colors.primary : colors.icon}
							/>
							<Text
								style={[
									styles.metadataValue,
									{ color: colors.textSecondary },
									isSelected && { color: colors.primary, fontWeight: "600" },
								]}
								numberOfLines={1}
							>
								{item.value}
							</Text>
						</Pressable>
					);
				})}
			</View>
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

	return (
		<Pressable
			style={[styles.card, { backgroundColor: colors.cardBackground }]}
			onPress={() =>
				router.push(`/metadata/${viewMode}/${encodeURIComponent(item)}`)
			}
		>
			<View style={styles.cardHeader}>
				<Text style={[styles.productName, { color: colors.text }]}>{item}</Text>
			</View>
		</Pressable>
	);
}

export default function Inventory() {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const {
		isLoading: sheetsLoading,
		error: sheetsError,
		refresh,
		addMetadata,
		addProduct: addProductToSheets,
		subscribeToMetadataChanges,
	} = useSheetsData();

	// Separate filters for internal and external products
	const defaultInternalFilters: InternalFilters = {
		product_type: [],
		texture: [],
		shape: [],
		occasions: [],
		sparkys_color: [],
	};

	const defaultExternalFilters: ExternalFilters = {
		manufacturer_color: [],
		brand: [],
		size: [],
		distributors: [],
	};

	const [permission, requestPermission] = useCameraPermissions();

	// New state for internal/external products
	const [internalFilters, setInternalFilters] = useState<InternalFilters>(
		defaultInternalFilters,
	);
	const [externalFilters, setExternalFilters] = useState<ExternalFilters>(
		defaultExternalFilters,
	);
	const [internalProducts, setInternalProductsState] = useState<
		InternalProduct[]
	>(getAllInternalProducts());
	const [externalProducts, setExternalProductsState] = useState<
		ExternalProduct[]
	>(getAllExternalProducts());

	// UI state
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [isScannerVisible, setIsScannerVisible] = useState(false);
	const [isViewDropdownVisible, setIsViewDropdownVisible] = useState(false);
	const [currentView, setCurrentView] = useState<ViewMode>("products");
	const [scannedBarcode, setScannedBarcode] = useState("");
	const [newMetadataValue, setNewMetadataValue] = useState("");

	// Internal Product Form State
	const [newInternalProduct, setNewInternalProduct] = useState({
		sparkys_product_name: "",
		product_type: "",
		sparkys_color: "",
		texture: "",
		shape: "",
		occasions: [] as string[],
		products: [] as string[],
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
	});

	useEffect(() => {
		// Update product data from store
		const internalData = getAllInternalProducts();
		const externalData = getAllExternalProducts();
		console.log("Loading products from store:", {
			internalCount: internalData?.length || 0,
			externalCount: externalData?.length || 0,
			internalData,
			externalData,
		});
		setInternalProductsState(internalData);
		setExternalProductsState(externalData);
	}, [sheetsLoading]);

	// Subscribe to metadata changes to update filters
	useEffect(() => {
		const unsubscribe = subscribeToMetadataChanges((change) => {
			const { fieldKey, oldValue, newValue } = change;
			setFilters((prevFilters) => {
				const currentSelectedValues = prevFilters[fieldKey as Field];
				if (currentSelectedValues && currentSelectedValues.includes(oldValue)) {
					// Replace old value with new value in the filter
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
		});

		return unsubscribe;
	}, [subscribeToMetadataChanges]);

	function getCurrentData() {
		switch (currentView) {
			case "products":
				// Return filtered internal products for hierarchical view
				return (
					internalProducts?.filter((internalProduct) => {
						// Apply internal product filters
						const matchesInternal = Object.entries(internalFilters).every(
							([key, selectedValues]) => {
								if (!selectedValues || selectedValues.length === 0) return true;
								if (key === "occasions") {
									// For occasions array, check if any selected occasion is in the product's occasions
									return selectedValues.some((selectedValue) =>
										internalProduct.occasions.includes(selectedValue),
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
							(arr) => arr.length > 0,
						);
						if (!hasExternalFilters) return true;

						const relatedExternals = externalProducts.filter((ext) =>
							internalProduct.products.includes(ext.unique_id_sku),
						);

						return relatedExternals.some((externalProduct) => {
							return Object.entries(externalFilters).every(
								([key, selectedValues]) => {
									if (!selectedValues || selectedValues.length === 0)
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
						});
					}) || []
				);
			case "productTypes":
				return PRODUCT_FIELD_OPTIONS.productType;
			case "colors": {
				// Combine both manufacturer and sparkys colors
				const manufacturerColors =
					PRODUCT_FIELD_OPTIONS.manufacturer_color || [];
				const sparkysColors = PRODUCT_FIELD_OPTIONS.sparkys_color || [];
				return [...new Set([...manufacturerColors, ...sparkysColors])].sort();
			}
			case "manufacturers":
				return PRODUCT_FIELD_OPTIONS.manufacturer;
			case "sizes":
				return PRODUCT_FIELD_OPTIONS.size;
			case "textures":
				return PRODUCT_FIELD_OPTIONS.texture;
			case "bagQuantities":
				return PRODUCT_FIELD_OPTIONS.bagQuantity;
			case "shapes":
				return PRODUCT_FIELD_OPTIONS.shape;
			case "distributors":
				return PRODUCT_FIELD_OPTIONS.distributor;
			case "occasions":
				return PRODUCT_FIELD_OPTIONS.occasion;
			default:
				return [];
		}
	}

	function getCurrentRenderItem() {
		return currentView === "products"
			? ({ item }: { item: InternalProduct }) => {
					console.log("Rendering InternalProductCard with item:", item);
					console.log(
						"External products count:",
						externalProducts?.length || 0,
					);
					return (
						<InternalProductCard
							internalProduct={item}
							externalProducts={externalProducts || []}
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
				const currentValues = prev[field as keyof InternalFilters] || [];
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
				const currentValues = prev[field as keyof ExternalFilters] || [];
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

	const currentData = getCurrentData();
	const currentRenderItem = getCurrentRenderItem();
	const currentKeyExtractor = getCurrentKeyExtractor();

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

	function handleFilterToggle(field: Field, value: string): void {
		setFilters((prev) => {
			const currentValues = prev[field] || [];
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

	function formatCategoryTitle(category: string): string {
		switch (category) {
			case "product_type":
				return "Type";
			case "sparkys_color":
				return "Color";
			case "manufacturer_color":
				return "Color";
			case "bag_quantity":
				return "Bag Quantity";
			case "manufacturer":
				return "Brand";
			case "bagQuantity":
				return "Bag Quantity";
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
			default:
				return (
					category.charAt(0).toUpperCase() +
					category.slice(1).replace(/([A-Z])/g, " $1")
				);
		}
	}

	const totalSelections =
		Object.values(internalFilters).reduce(
			(sum, arr) => sum + (arr?.length || 0),
			0,
		) +
		Object.values(externalFilters).reduce(
			(sum, arr) => sum + (arr?.length || 0),
			0,
		);

	function resetNewProductForm(): void {
		setScannedBarcode("");
		setNewMetadataValue("");
		setNewInternalProduct({
			sparkys_product_name: "",
			product_type: "",
			sparkys_color: "",
			texture: "",
			shape: "",
			occasions: [],
			products: [],
		});
		setNewExternalProduct({
			unique_id_sku: "",
			manufacturer_color: "",
			brand: "",
			size: "",
			bag_quantity: 50,
			distributors: [],
			quantity: 0,
		});
	}

	function getSheetNameForMetadata(viewMode: string): string | null {
		switch (viewMode) {
			case "productTypes":
				return "product_types";
			case "colors":
				return "colors";
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
				: currentView === "colors"
					? "color"
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
												: null;

		if (!fieldKey) return;

		const existingValues = PRODUCT_FIELD_OPTIONS[fieldKey];
		if (existingValues.includes(trimmedValue)) {
			Alert.alert("Error", "This value already exists");
			return;
		}

		const sheetName = getSheetNameForMetadata(currentView);
		if (!sheetName) {
			Alert.alert("Error", "Cannot add items to this category");
			return;
		}

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
			Alert.alert("Error", "Failed to add item to spreadsheet");
		}
	}

	function handleBarcodeScanned(data: string): void {
		setScannedBarcode(data);
		setIsScannerVisible(false);

		// Check if external product exists
		const existingExternal = getExternalProductBySku(data);
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
		setIsAddModalVisible(true);
	}

	function handleViewChange(viewMode: ViewMode): void {
		setCurrentView(viewMode);
		setIsViewDropdownVisible(false);
	}

	const currentViewLabel =
		VIEW_OPTIONS.find((option) => option.key === currentView)?.label ||
		"Products";

	async function handleAddInternalProductSubmit(): Promise<void> {
		if (!newInternalProduct.sparkys_product_name.trim()) {
			Alert.alert("Error", "Please enter a product name");
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

		try {
			// TODO: Add internal product to spreadsheet
			// For now, just show success message
			setIsAddModalVisible(false);
			resetNewProductForm();
			Alert.alert(
				"Success",
				`Internal product "${newInternalProduct.sparkys_product_name}" has been created!`,
			);
		} catch (error) {
			Alert.alert("Error", "Failed to add internal product to spreadsheet");
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

		if (newExternalProduct.quantity < 0) {
			Alert.alert("Error", "Please enter a valid quantity");
			return;
		}

		try {
			// TODO: Add external product to spreadsheet
			// For now, just show success message
			setIsAddModalVisible(false);
			resetNewProductForm();
			Alert.alert(
				"Success",
				`External product with SKU "${newExternalProduct.unique_id_sku}" has been added!`,
			);
		} catch (error) {
			Alert.alert("Error", "Failed to add external product to spreadsheet");
		}
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
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

			{sheetsLoading && (
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

			<Pagination
				data={currentData}
				renderItem={currentRenderItem}
				keyExtractor={currentKeyExtractor}
			/>

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
						{Object.entries({
							product_type: PRODUCT_FIELD_OPTIONS.productType,
							sparkys_color: PRODUCT_FIELD_OPTIONS.sparkys_color,
							texture: PRODUCT_FIELD_OPTIONS.texture,
							shape: PRODUCT_FIELD_OPTIONS.shape,
							occasions: PRODUCT_FIELD_OPTIONS.occasion,
						}).map(([category, options]) => (
							<CollapsibleFilterSection
								key={category}
								title={formatCategoryTitle(category)}
								options={options}
								selectedValues={
									internalFilters[category as keyof InternalFilters] || []
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
						{Object.entries({
							manufacturer_color: PRODUCT_FIELD_OPTIONS.manufacturer_color,
							brand: PRODUCT_FIELD_OPTIONS.manufacturer,
							size: PRODUCT_FIELD_OPTIONS.size,
							distributors: PRODUCT_FIELD_OPTIONS.distributor,
						}).map(([category, options]) => (
							<CollapsibleFilterSection
								key={category}
								title={formatCategoryTitle(category)}
								options={options}
								selectedValues={
									externalFilters[category as keyof ExternalFilters] || []
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
								style={[styles.saveButton, { backgroundColor: colors.primary }]}
							>
								<Ionicons name="checkmark" size={24} color="white" />
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
										<View style={styles.inputGroup}>
											<Text style={[styles.inputLabel, { color: colors.text }]}>
												Barcode (SKU) *
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
											title="Manufacturer Color *"
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
											title="Brand *"
											options={PRODUCT_FIELD_OPTIONS.manufacturer || []}
											selectedValue={newExternalProduct.brand}
											onSelectionChange={(brand) =>
												setNewExternalProduct((prev) => ({ ...prev, brand }))
											}
										/>

										<CollapsibleRadioSection
											title="Size *"
											options={PRODUCT_FIELD_OPTIONS.size || []}
											selectedValue={newExternalProduct.size}
											onSelectionChange={(size) =>
												setNewExternalProduct((prev) => ({ ...prev, size }))
											}
										/>

										<View style={styles.inputGroup}>
											<Text style={[styles.inputLabel, { color: colors.text }]}>
												Bag Quantity *
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
														bag_quantity: parseInt(text) || 0,
													}))
												}
												placeholder="50"
												placeholderTextColor={colors.textSecondary}
												keyboardType="numeric"
											/>
										</View>

										<View style={styles.inputGroup}>
											<Text style={[styles.inputLabel, { color: colors.text }]}>
												Current Quantity *
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
														quantity: parseInt(text) || 0,
													}))
												}
												placeholder="0"
												placeholderTextColor={colors.textSecondary}
												keyboardType="numeric"
											/>
										</View>
									</>
								) : (
									// Internal Product Form
									<>
										<View style={styles.inputGroup}>
											<Text style={[styles.inputLabel, { color: colors.text }]}>
												Sparky's Product Name *
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
												value={newInternalProduct.sparkys_product_name}
												onChangeText={(text) =>
													setNewInternalProduct((prev) => ({
														...prev,
														sparkys_product_name: text,
													}))
												}
												placeholder="Enter product name"
												placeholderTextColor={colors.textSecondary}
												autoFocus
											/>
										</View>

										<CollapsibleRadioSection
											title="Product Type *"
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
											title="Sparky's Color *"
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
										{currentViewLabel.slice(0, -1)} Name *
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
				visible={isScannerVisible}
				animationType="slide"
				presentationStyle="fullScreen"
				onRequestClose={() => setIsScannerVisible(false)}
			>
				<View style={styles.scannerContainer}>
					<View style={styles.scannerHeader}>
						<Text style={styles.scannerTitle}>Scan Barcode</Text>
						<Pressable
							onPress={() => setIsScannerVisible(false)}
							style={styles.closeButton}
						>
							<Ionicons name="close" size={24} color="white" />
						</Pressable>
					</View>
					<CameraView
						style={styles.camera}
						barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
						onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
					/>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
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
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
	},
	modalScrollView: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
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
		padding: 16,
		paddingTop: 0,
		backgroundColor: "#f8f9fa",
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
		paddingTop: 60,
		paddingBottom: 16,
		backgroundColor: "rgba(0, 0, 0, 0.8)",
	},
	scannerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "white",
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
		marginTop: 20,
		marginBottom: 12,
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
});
