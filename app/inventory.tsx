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
import Pagination from "@/components/Pagination";
import {
	convertProductToSheet,
	type Field,
	type FieldFilters,
	PRODUCT_FIELD_OPTIONS,
	type Product,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { addProduct, getAllProducts, getProductById } from "@/store/products";

type ViewMode =
	| "products"
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

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PillCheckboxProps {
	label: string;
	selected: boolean;
	onPress: () => void;
}

function PillCheckbox({ label, selected, onPress }: PillCheckboxProps) {
	return (
		<Pressable
			style={[styles.pill, selected && styles.pillSelected]}
			onPress={onPress}
		>
			<Text style={[styles.pillText, selected && styles.pillTextSelected]}>
				{label}
			</Text>
		</Pressable>
	);
}

interface CollapsibleFilterSectionProps {
	title: string;
	options: string[];
	selectedValues: string[];
	onSelectionChange: (values: string[]) => void;
}

interface CollapsibleRadioSectionProps {
	title: string;
	options: string[];
	selectedValue: string;
	onSelectionChange: (value: string) => void;
}

function CollapsibleFilterSection({
	title,
	options,
	selectedValues,
	onSelectionChange,
}: CollapsibleFilterSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);

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
		<View style={styles.filterSection}>
			<Pressable style={styles.filterHeader} onPress={toggleExpansion}>
				<Text style={styles.filterHeaderText}>
					{title} {hasSelections && `(${selectedValues.length})`}
				</Text>
				<Ionicons
					name={isExpanded ? "chevron-down" : "chevron-forward"}
					size={16}
					color="#666"
				/>
			</Pressable>

			{(isExpanded || hasSelections) && (
				<View style={styles.pillContainer}>
					{displayOptions.map((option) => (
						<PillCheckbox
							key={option}
							label={option}
							selected={selectedValues.includes(option)}
							onPress={() => handlePillPress(option)}
						/>
					))}
					{!isExpanded && hasSelections && (
						<Pressable style={styles.expandPill} onPress={toggleExpansion}>
							<Text style={styles.expandText}>
								+{options.length - selectedValues.length} more
							</Text>
						</Pressable>
					)}
				</View>
			)}
		</View>
	);
}

function CollapsibleRadioSection({
	title,
	options,
	selectedValue,
	onSelectionChange,
}: CollapsibleRadioSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	}

	function handlePillPress(value: string): void {
		onSelectionChange(value);
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(false);
	}

	const hasSelection = selectedValue !== "";

	return (
		<View style={styles.filterSection}>
			<Pressable style={styles.filterHeader} onPress={toggleExpansion}>
				<Text style={styles.filterHeaderText}>{title}</Text>
				<View style={styles.headerRight}>
					{!isExpanded && hasSelection && (
						<View style={[styles.pill, styles.pillSelected]}>
							<Text style={[styles.pillText, styles.pillTextSelected]}>
								{selectedValue}
							</Text>
						</View>
					)}
					<Ionicons
						name={isExpanded ? "chevron-down" : "chevron-forward"}
						size={16}
						color="#666"
					/>
				</View>
			</Pressable>

			{isExpanded && (
				<View style={styles.pillContainer}>
					{options.map((option) => (
						<PillCheckbox
							key={option}
							label={option}
							selected={selectedValue === option}
							onPress={() => handlePillPress(option)}
						/>
					))}
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
		<View style={styles.card}>
			<Pressable
				style={styles.cardHeader}
				onPress={() => router.push(`/product/${product.id}`)}
			>
				<Text style={styles.productName}>{product.name}</Text>
				<Text style={styles.price}>{product.quantity}</Text>
			</Pressable>

			<View style={styles.metadataGrid}>
				{metadataItems.map((item, index) => {
					const isSelected = isMetadataSelected(item.field, item.value!);
					return (
						<Pressable
							key={item.field}
							style={[
								styles.metadataItem,
								isSelected && styles.metadataItemSelected,
							]}
							onPress={() => handleMetadataPress(item.field, item.value!)}
						>
							<Ionicons
								name={item.icon as any}
								size={16}
								color={isSelected ? "#007bff" : "#666"}
							/>
							<Text
								style={[
									styles.metadataValue,
									isSelected && styles.metadataValueSelected,
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
	return (
		<Pressable
			style={styles.card}
			onPress={() =>
				router.push(`/metadata/${viewMode}/${encodeURIComponent(item)}`)
			}
		>
			<View style={styles.cardHeader}>
				<Text style={styles.productName}>{item}</Text>
			</View>
		</Pressable>
	);
}

export default function Inventory() {
	const {
		isLoading: sheetsLoading,
		error: sheetsError,
		refresh,
		addMetadata,
		addProduct: addProductToSheets,
		subscribeToMetadataChanges,
	} = useSheetsData();

	const defaultFilters: FieldFilters = {
		productType: [],
		color: [],
		manufacturer: [],
		size: [],
		texture: [],
		bagQuantity: [],
		shape: [],
		distributor: [],
		occasion: [],
	};
	const emptyProduct: Omit<Product, "id"> = {
		name: "",
		quantity: 0,
		productType: PRODUCT_FIELD_OPTIONS.productType[0] || "",
		color: PRODUCT_FIELD_OPTIONS.color[0] || "",
		manufacturer: PRODUCT_FIELD_OPTIONS.manufacturer[0] || "",
		size: PRODUCT_FIELD_OPTIONS.size[0] || "",
		texture: PRODUCT_FIELD_OPTIONS.texture[0] || "",
		bagQuantity: parseInt(PRODUCT_FIELD_OPTIONS.bagQuantity[0] || "50", 10),
		shape: PRODUCT_FIELD_OPTIONS.shape[0] || "",
		distributor: PRODUCT_FIELD_OPTIONS.distributor[0] || "",
		occasion: PRODUCT_FIELD_OPTIONS.occasion[0] || "",
	};

	const [permission, requestPermission] = useCameraPermissions();

	const [filters, setFilters] = useState<FieldFilters>(defaultFilters);
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [isScannerVisible, setIsScannerVisible] = useState(false);
	const [isViewDropdownVisible, setIsViewDropdownVisible] = useState(false);
	const [currentView, setCurrentView] = useState<ViewMode>("products");
	const [products, setProductsState] = useState<Product[]>(getAllProducts());
	const [newProduct, setNewProduct] = useState(emptyProduct);
	const [scannedBarcode, setScannedBarcode] = useState("");
	const [newMetadataValue, setNewMetadataValue] = useState("");

	useEffect(() => {
		setProductsState(getAllProducts());
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
				return (
					products?.filter((product) => {
						if (!filters) return true;
						return Object.entries(filters).every(([key, selectedValues]) => {
							if (!selectedValues || selectedValues.length === 0) return true;
							const productValue = product[key as Field] as string;
							return selectedValues.includes(productValue);
						});
					}) || []
				);
			case "productTypes":
				return PRODUCT_FIELD_OPTIONS.productType;
			case "colors":
				return PRODUCT_FIELD_OPTIONS.color;
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
			? ({ item }: { item: Product }) => (
					<ProductCard
						item={item}
						filters={filters}
						onFilterToggle={handleFilterToggle}
					/>
				)
			: ({ item }: { item: string }) => (
					<MetadataCard item={item} viewMode={currentView} />
				);
	}

	function getCurrentKeyExtractor() {
		return currentView === "products"
			? (item: Product) => item.id
			: (item: string) => item;
	}

	const currentData = getCurrentData();
	const currentRenderItem = getCurrentRenderItem();
	const currentKeyExtractor = getCurrentKeyExtractor();

	function clearAllFilters(): void {
		setFilters(defaultFilters);
	}

	function handleFilterChange(category: Field, values: string[]): void {
		setFilters((prev) => ({
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
		if (category === "manufacturer") return "Brand";
		if (category === "bagQuantity") return "Bag Quantity";
		if (category === "productType") return "Product Type";

		return (
			category.charAt(0).toUpperCase() +
			category.slice(1).replace(/([A-Z])/g, " $1")
		);
	}

	const totalSelections = Object.values(filters).reduce(
		(sum, arr) => sum + (arr?.length || 0),
		0,
	);

	function resetNewProductForm(): void {
		setNewProduct(emptyProduct);
		setScannedBarcode("");
		setNewMetadataValue("");
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

		const existingProduct = getProductById(data);
		if (existingProduct) {
			router.push(`/product/${data}`);
		} else {
			setIsAddModalVisible(true);
		}
	}

	function handleAddButtonPress(): void {
		if (currentView === "products") {
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

	function handleViewChange(viewMode: ViewMode): void {
		setCurrentView(viewMode);
		setIsViewDropdownVisible(false);
	}

	const currentViewLabel =
		VIEW_OPTIONS.find((option) => option.key === currentView)?.label ||
		"Products";

	async function handleAddProduct(): Promise<void> {
		if (!newProduct.name.trim() || newProduct.quantity <= 0) {
			Alert.alert("Error", "Please enter both name and quantity");
			return;
		}

		if (!scannedBarcode.trim()) {
			Alert.alert("Error", "Please scan a barcode first");
			return;
		}

		if (Number.isNaN(newProduct.quantity) || newProduct.quantity <= 0) {
			Alert.alert("Error", "Please enter a valid quantity");
			return;
		}

		const productToAdd: Product = {
			id: scannedBarcode,
			name: newProduct.name.trim(),
			quantity: newProduct.quantity,
			bagQuantity: newProduct.bagQuantity,
			productType: newProduct.productType,
			occasion: newProduct.occasion,
			color: newProduct.color,
			manufacturer: newProduct.manufacturer,
			size: newProduct.size,
			texture: newProduct.texture,
			shape: newProduct.shape,
			distributor: newProduct.distributor,
		};

		try {
			const productSheet = convertProductToSheet(productToAdd);
			const result = await addProductToSheets(productSheet);

			if (result.success) {
				setIsAddModalVisible(false);
				resetNewProductForm();
				Alert.alert(
					"Success",
					`"${productToAdd.name}" has been added to inventory!`,
				);
			} else {
				Alert.alert("Error", result.error || "Failed to add product");
			}
		} catch (error) {
			Alert.alert("Error", "Failed to add product to spreadsheet");
		}
	}

	return (
		<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
			<View style={styles.headerContainer}>
				<Pressable
					onPress={() => setIsViewDropdownVisible(!isViewDropdownVisible)}
					style={styles.titleButton}
				>
					<Text style={styles.title}>{currentViewLabel}</Text>
					<Ionicons
						name={isViewDropdownVisible ? "chevron-up" : "chevron-down"}
						size={20}
						color="#1a1a1a"
					/>
				</Pressable>
				<View style={styles.headerActions}>
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
								style={styles.filterButton}
							>
								<Ionicons name="options-outline" size={24} color="#007bff" />
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
				<View style={styles.dropdown}>
					{VIEW_OPTIONS.map((option) => (
						<Pressable
							key={option.key}
							onPress={() => handleViewChange(option.key)}
							style={[
								styles.dropdownItem,
								currentView === option.key && styles.dropdownItemActive,
							]}
						>
							<Text
								style={[
									styles.dropdownText,
									currentView === option.key && styles.dropdownTextActive,
								]}
							>
								{option.label}
							</Text>
						</Pressable>
					))}
				</View>
			)}

			{sheetsLoading && (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="small" color="#007bff" />
					<Text style={styles.loadingText}>Loading data...</Text>
				</View>
			)}

			{sheetsError && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{sheetsError}</Text>
					<Pressable onPress={refresh} style={styles.retryButton}>
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
				<View style={styles.modalContainer}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Filter Inventory</Text>
						<View style={styles.modalHeaderActions}>
							{totalSelections > 0 && (
								<Pressable onPress={clearAllFilters} style={styles.clearButton}>
									<Text style={styles.clearText}>Clear All</Text>
								</Pressable>
							)}
							<Pressable
								onPress={() => setIsFilterModalVisible(false)}
								style={styles.closeButton}
							>
								<Ionicons name="close" size={24} color="#6c757d" />
							</Pressable>
						</View>
					</View>

					<ScrollView
						style={styles.modalScrollView}
						showsVerticalScrollIndicator={false}
					>
						{Object.entries(PRODUCT_FIELD_OPTIONS).map(
							([category, options]) => (
								<CollapsibleFilterSection
									key={category}
									title={formatCategoryTitle(category)}
									options={options}
									selectedValues={filters[category as Field] || []}
									onSelectionChange={(values) =>
										handleFilterChange(category as Field, values)
									}
								/>
							),
						)}
					</ScrollView>
				</View>
			</Modal>

			<Modal
				visible={isAddModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsAddModalVisible(false)}
			>
				<View style={styles.modalContainer}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>
							{currentView === "products"
								? "Add New Product"
								: `Add New ${currentViewLabel.slice(0, -1)}`}
						</Text>
						<View style={styles.modalHeaderActions}>
							<Pressable
								onPress={
									currentView === "products"
										? handleAddProduct
										: handleAddMetadata
								}
								style={styles.saveButton}
							>
								<Ionicons name="checkmark" size={24} color="white" />
							</Pressable>
							<Pressable
								onPress={() => {
									setIsAddModalVisible(false);
									resetNewProductForm();
								}}
								style={styles.closeButton}
							>
								<Ionicons name="close" size={24} color="#6c757d" />
							</Pressable>
						</View>
					</View>

					<ScrollView
						style={styles.formScrollView}
						showsVerticalScrollIndicator={false}
					>
						{currentView === "products" ? (
							<>
								<View style={styles.formSection}>
									<Text style={styles.sectionTitle}>Basic Information</Text>

									<View style={styles.inputGroup}>
										<Text style={styles.inputLabel}>Barcode *</Text>
										<TextInput
											style={[styles.textInput, styles.disabledInput]}
											value={scannedBarcode}
											placeholder="Scan a barcode to populate"
											placeholderTextColor="#6c757d"
											editable={false}
										/>
									</View>

									<View style={styles.inputGroup}>
										<Text style={styles.inputLabel}>Product Name *</Text>
										<TextInput
											style={styles.textInput}
											value={newProduct.name}
											onChangeText={(text) =>
												setNewProduct((prev) => ({ ...prev, name: text }))
											}
											placeholder="Enter product name"
											placeholderTextColor="#6c757d"
										/>
									</View>

									<View style={styles.inputGroup}>
										<Text style={styles.inputLabel}>Quantity *</Text>
										<TextInput
											style={styles.textInput}
											value={
												newProduct.quantity === 0
													? ""
													: newProduct.quantity.toString()
											}
											onChangeText={(text) => {
												const numValue = text === "" ? 0 : parseInt(text, 10);
												setNewProduct((prev) => ({
													...prev,
													quantity: Number.isNaN(numValue) ? 0 : numValue,
												}));
											}}
											placeholder="0"
											placeholderTextColor="#6c757d"
											keyboardType="number-pad"
										/>
									</View>
								</View>

								<View style={styles.formSection}>
									<Text style={styles.sectionTitle}>Product Details</Text>

									{Object.entries(PRODUCT_FIELD_OPTIONS).map(
										([field, options]) => (
											<CollapsibleRadioSection
												key={field}
												title={formatCategoryTitle(field)}
												options={options}
												selectedValue={
													newProduct[field as keyof typeof newProduct] as string
												}
												onSelectionChange={(value) =>
													setNewProduct((prev) => ({ ...prev, [field]: value }))
												}
											/>
										),
									)}
								</View>
							</>
						) : (
							<View style={styles.formSection}>
								<Text style={styles.sectionTitle}>Add New Value</Text>

								<View style={styles.inputGroup}>
									<Text style={styles.inputLabel}>
										{currentViewLabel.slice(0, -1)} Name *
									</Text>
									<TextInput
										style={styles.textInput}
										value={newMetadataValue}
										onChangeText={setNewMetadataValue}
										placeholder={`Enter ${currentViewLabel.slice(0, -1).toLowerCase()} name`}
										placeholderTextColor="#6c757d"
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
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		margin: 4,
	},
	pillSelected: {
		backgroundColor: "#007bff",
		borderColor: "#007bff",
	},
	pillText: {
		color: "#495057",
		fontSize: 14,
		fontWeight: "500",
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
});
