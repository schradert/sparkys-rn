import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { buildMetadataItems } from "@/components/internalProductCard/metadataItems";
import { styles } from "@/components/internalProductCard/styles";
import type { InternalProductCardProps } from "@/components/internalProductCard/types";
import type { ThemeColors } from "@/constants/Colors";
import type { InternalProduct } from "@/constants/Products";

interface CardMetadataProps {
	internalProduct: InternalProduct;
	colors: ThemeColors;
	selectedFilters?: InternalProductCardProps["selectedFilters"];
	onMetadataPress?: (field: string, value: string) => void;
}

/** The clickable metadata grid + occasion pills shown on every product card. */
export function CardMetadata({
	internalProduct,
	colors,
	selectedFilters,
	onMetadataPress,
}: CardMetadataProps) {
	const metadataItems = buildMetadataItems(internalProduct);

	const handleMetadataPress = (field: string, value: string) => {
		onMetadataPress?.(field, value);
	};

	const isMetadataSelected = (field: string, value: string): boolean => {
		const internalFilters = selectedFilters?.internal;
		if (!internalFilters) return false;
		const fieldFilters = internalFilters[field as keyof typeof internalFilters];
		return fieldFilters ? fieldFilters.includes(value) : false;
	};

	return (
		<>
			<View style={styles.metadataGrid}>
				{metadataItems.map((item) => {
					const isSelected = isMetadataSelected(item.field, item.value);
					return (
						<Pressable
							key={item.field}
							style={[
								styles.metadataItem,
								{ backgroundColor: colors.metadataBackground },
								isSelected && { backgroundColor: colors.primary },
							]}
							onPress={() => handleMetadataPress(item.field, item.value)}
						>
							<Ionicons
								name={item.icon}
								size={16}
								color={isSelected ? "white" : colors.icon}
							/>
							<Text
								style={[
									styles.metadataValue,
									{ color: colors.textSecondary },
									isSelected && { color: "white", fontWeight: "600" },
								]}
								numberOfLines={1}
							>
								{item.value}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{internalProduct?.occasions &&
				Array.isArray(internalProduct.occasions) &&
				internalProduct.occasions.length > 0 && (
					<View style={styles.occasionsContainer}>
						{internalProduct.occasions?.map((occasion, index) => {
							const isSelected = isMetadataSelected("occasions", occasion);
							return (
								<Pressable
									// biome-ignore lint/suspicious/noArrayIndexKey: occasion names are not guaranteed unique within the list, so a value+index composite is used; the list is static display only
									key={`${occasion}-${index}`}
									style={[
										styles.occasionPill,
										{ backgroundColor: colors.metadataBackground },
										isSelected && { backgroundColor: colors.primary },
									]}
									onPress={() => handleMetadataPress("occasions", occasion)}
								>
									<Ionicons
										name="calendar-outline"
										size={16}
										color={isSelected ? "white" : colors.icon}
									/>
									<Text
										style={[
											styles.occasionText,
											{ color: colors.textSecondary },
											isSelected && { color: "white", fontWeight: "600" },
										]}
										numberOfLines={1}
									>
										{occasion}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}
		</>
	);
}
