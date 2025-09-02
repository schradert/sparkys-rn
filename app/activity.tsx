import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Modal,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import type { AuditEvent } from "@/services/googleSheets";

export default function Activity() {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const { getAuditEvents } = useSheetsData();

	const [events, setEvents] = useState<AuditEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
	const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

	const loadEvents = async (isRefresh = false, offset = 0) => {
		try {
			if (isRefresh) {
				setRefreshing(true);
				setEvents([]);
				setHasMore(true);
			} else if (offset === 0) {
				setLoading(true);
			} else {
				setLoadingMore(true);
			}

			const newEvents = await getAuditEvents(50, offset);

			if (isRefresh || offset === 0) {
				setEvents(newEvents);
			} else {
				setEvents((prev) => [...prev, ...newEvents]);
			}

			setHasMore(newEvents.length === 50);
		} catch (error) {
			console.error("Failed to load events:", error);
		} finally {
			setLoading(false);
			setRefreshing(false);
			setLoadingMore(false);
		}
	};

	useEffect(() => {
		loadEvents();
	}, []);

	const handleRefresh = () => {
		loadEvents(true);
	};

	const handleLoadMore = () => {
		if (!loadingMore && hasMore) {
			loadEvents(false, events.length);
		}
	};

	const handleEventPress = (event: AuditEvent) => {
		setSelectedEvent(event);
		setIsDetailModalVisible(true);
	};

	const getEventIcon = (
		eventType: string,
		objectType: string,
		changes?: string,
		beforeState?: string,
	) => {
		switch (eventType) {
			case "create":
				return "add-circle-outline";
			case "edit":
				return "pencil-outline";
			case "quantity_update":
				// Check if quantity increased or decreased
				if (changes && beforeState) {
					try {
						const changesObj = JSON.parse(changes);
						const beforeObj = JSON.parse(beforeState);
						if (
							changesObj.quantity !== undefined &&
							beforeObj.quantity !== undefined
						) {
							return changesObj.quantity > beforeObj.quantity
								? "arrow-up"
								: "arrow-down";
						}
					} catch (e) {
						console.log(
							"Failed to parse quantity changes for icon:",
							e,
							changes,
							beforeState,
						);
					}
				}
				return "arrow-down"; // Default to down arrow if parsing fails
			case "archive":
				return "archive-outline";
			case "unarchive":
				return "refresh-outline";
			default:
				return "information-circle-outline";
		}
	};

	const getEventColor = (
		eventType: string,
		changes?: string,
		beforeState?: string,
	) => {
		switch (eventType) {
			case "create":
				return colors.success;
			case "edit":
				return colors.primary;
			case "quantity_update":
				// Check if quantity increased or decreased
				if (changes && beforeState) {
					try {
						const changesObj = JSON.parse(changes);
						const beforeObj = JSON.parse(beforeState);
						if (
							changesObj.quantity !== undefined &&
							beforeObj.quantity !== undefined
						) {
							return changesObj.quantity > beforeObj.quantity
								? colors.success
								: colors.error;
						}
					} catch (e) {
						console.log(
							"Failed to parse quantity changes:",
							e,
							changes,
							beforeState,
						);
					}
				}
				return colors.error; // Default to red if parsing fails
			case "archive":
				return "#ff6b35"; // Orange
			case "unarchive":
				return "#ffc107"; // Yellow
			default:
				return colors.textSecondary;
		}
	};

	const formatTimestamp = (timestamp: string) => {
		try {
			const date = new Date(timestamp);
			return date.toLocaleString();
		} catch {
			return timestamp;
		}
	};

	const navigateToItem = (event: AuditEvent) => {
		setIsDetailModalVisible(false);

		switch (event.object_type) {
			case "internal_product":
				router.push(
					`/internal-product/${encodeURIComponent(event.object_name)}`,
				);
				break;
			case "external_product":
				router.push(`/external-product/${encodeURIComponent(event.object_id)}`);
				break;
			case "metadata":
				router.push(`/metadata/${event.sheet_name}`);
				break;
		}
	};

	const renderEventCard = ({ item }: { item: AuditEvent }) => (
		<Pressable
			style={[
				styles.eventCard,
				{ backgroundColor: colors.cardBackground, borderColor: colors.border },
			]}
			onPress={() => handleEventPress(item)}
		>
			<View style={styles.eventHeader}>
				<View style={styles.eventInfo}>
					<View style={styles.eventTitleRow}>
						<Ionicons
							name={getEventIcon(
								item.event_type,
								item.object_type,
								item.changes,
								item.before_state,
							)}
							size={20}
							color={getEventColor(
								item.event_type,
								item.changes,
								item.before_state,
							)}
						/>
						<Text
							style={[
								styles.eventType,
								{
									color: getEventColor(
										item.event_type,
										item.changes,
										item.before_state,
									),
								},
							]}
						>
							{item.event_type === "quantity_update"
								? // Check if deposited or withdrew
									(() => {
										try {
											const changesObj = JSON.parse(item.changes);
											const beforeObj = JSON.parse(item.before_state);
											if (
												changesObj.quantity !== undefined &&
												beforeObj.quantity !== undefined
											) {
												return changesObj.quantity > beforeObj.quantity
													? "Deposited"
													: "Withdrew";
											}
										} catch (e) {
											console.log(
												"Failed to parse quantity changes for label:",
												e,
												item.changes,
												item.before_state,
											);
										}
										return "Withdrew"; // Default to withdrew if parsing fails
									})()
								: item.event_type.charAt(0).toUpperCase() +
									item.event_type.slice(1) +
									(item.event_type === "edit" ? "ed" : "d")}
						</Text>
						<Text style={[styles.objectType, { color: colors.textSecondary }]}>
							{item.object_type.replace("_", " ")}
						</Text>
					</View>
					<Text style={[styles.objectName, { color: colors.text }]}>
						{item.object_name}
					</Text>
					<Text style={[styles.timestamp, { color: colors.textSecondary }]}>
						{formatTimestamp(item.timestamp)} • {item.user_email}
					</Text>
				</View>
				<Ionicons
					name="chevron-forward"
					size={20}
					color={colors.textSecondary}
				/>
			</View>
		</Pressable>
	);

	const renderFooter = () => {
		if (!loadingMore) return null;
		return (
			<View style={styles.loadingFooter}>
				<ActivityIndicator size="small" color={colors.primary} />
			</View>
		);
	};

	if (loading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
			>
				<View
					style={[
						styles.header,
						{
							backgroundColor: colors.cardBackground,
							borderBottomColor: colors.borderLight,
						},
					]}
				>
					<Pressable onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={colors.text} />
					</Pressable>
					<Text style={[styles.headerTitle, { color: colors.text }]}>
						Activity
					</Text>
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<View
				style={[
					styles.header,
					{
						backgroundColor: colors.cardBackground,
						borderBottomColor: colors.borderLight,
					},
				]}
			>
				<Pressable onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={colors.text} />
				</Pressable>
				<Text style={[styles.headerTitle, { color: colors.text }]}>
					Activity
				</Text>
			</View>

			<FlatList
				data={events}
				renderItem={renderEventCard}
				keyExtractor={(item) => item.id.toString()}
				style={styles.eventsList}
				contentContainerStyle={styles.eventsListContent}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={handleRefresh}
						colors={[colors.primary]}
						tintColor={colors.primary}
					/>
				}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.1}
				ListFooterComponent={renderFooter}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<Ionicons
							name="time-outline"
							size={48}
							color={colors.textSecondary}
						/>
						<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
							No activity events found
						</Text>
					</View>
				}
			/>

			<Modal
				visible={isDetailModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsDetailModalVisible(false)}
			>
				<SafeAreaView
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
							Event Details
						</Text>
						<Pressable
							onPress={() => setIsDetailModalVisible(false)}
							style={[styles.closeButton, { backgroundColor: colors.surface }]}
						>
							<Ionicons name="close" size={24} color={colors.textSecondary} />
						</Pressable>
					</View>

					{selectedEvent && (
						<View style={styles.detailContent}>
							<View
								style={[
									styles.detailCard,
									{ backgroundColor: colors.cardBackground },
								]}
							>
								<View style={styles.detailHeader}>
									<Ionicons
										name={getEventIcon(
											selectedEvent.event_type,
											selectedEvent.object_type,
											selectedEvent.changes,
											selectedEvent.before_state,
										)}
										size={24}
										color={getEventColor(
											selectedEvent.event_type,
											selectedEvent.changes,
											selectedEvent.before_state,
										)}
									/>
									<Text
										style={[
											styles.detailEventType,
											{
												color: getEventColor(
													selectedEvent.event_type,
													selectedEvent.changes,
													selectedEvent.before_state,
												),
											},
										]}
									>
										{selectedEvent.event_type === "quantity_update"
											? // Check if deposited or withdrew
												(() => {
													try {
														const changesObj = JSON.parse(
															selectedEvent.changes,
														);
														const beforeObj = JSON.parse(
															selectedEvent.before_state,
														);
														if (
															changesObj.quantity !== undefined &&
															beforeObj.quantity !== undefined
														) {
															return changesObj.quantity > beforeObj.quantity
																? "Deposited"
																: "Withdrew";
														}
													} catch (e) {
														console.log(
															"Failed to parse quantity changes for detail label:",
															e,
															selectedEvent.changes,
															selectedEvent.before_state,
														);
													}
													return "Withdrew"; // Default to withdrew if parsing fails
												})()
											: selectedEvent.event_type.charAt(0).toUpperCase() +
												selectedEvent.event_type.slice(1) +
												(selectedEvent.event_type === "edit" ? "ed" : "d")}
									</Text>
								</View>

								<Text style={[styles.detailObjectName, { color: colors.text }]}>
									{selectedEvent.object_name}
								</Text>

								<Text
									style={[
										styles.detailObjectType,
										{ color: colors.textSecondary },
									]}
								>
									{selectedEvent.object_type.replace("_", " ").toUpperCase()}
								</Text>

								<Text
									style={[
										styles.detailTimestamp,
										{ color: colors.textSecondary },
									]}
								>
									{formatTimestamp(selectedEvent.timestamp)}
								</Text>

								<Text
									style={[
										styles.detailUserEmail,
										{ color: colors.textSecondary },
									]}
								>
									by {selectedEvent.user_email}
								</Text>

								{selectedEvent.changes &&
									selectedEvent.changes !== "{}" &&
									selectedEvent.before_state &&
									selectedEvent.before_state !== "{}" && (
										<View style={styles.changesSection}>
											<Text
												style={[styles.changesTitle, { color: colors.text }]}
											>
												Changes:
											</Text>
											{(() => {
												try {
													const changesObj = JSON.parse(selectedEvent.changes);
													const beforeObj = JSON.parse(
														selectedEvent.before_state,
													);

													return (
														<View style={styles.changesGrid}>
															{Object.keys(changesObj).map((field) => {
																const oldValue = beforeObj[field];
																const newValue = changesObj[field];

																const getFieldIcon = (fieldName: string) => {
																	switch (fieldName) {
																		case "quantity":
																			return "calculator-outline";
																		case "manufacturer_color":
																			return "color-palette-outline";
																		case "brand":
																			return "business-outline";
																		case "size":
																			return "resize-outline";
																		case "bag_quantity":
																			return "bag-outline";
																		case "distributors":
																			return "storefront-outline";
																		case "product_type":
																			return "shapes-outline";
																		case "sparkys_color":
																			return "color-palette-outline";
																		case "texture":
																			return "hand-left-outline";
																		case "shape":
																			return "diamond-outline";
																		case "occasions":
																			return "calendar-outline";
																		case "status":
																			return "flag-outline";
																		case "name":
																			return "pricetag-outline";
																		default:
																			return "information-circle-outline";
																	}
																};

																const isClickableField = (
																	fieldName: string,
																) => {
																	return [
																		"manufacturer_color",
																		"brand",
																		"size",
																		"bag_quantity",
																		"distributors",
																		"product_type",
																		"sparkys_color",
																		"texture",
																		"shape",
																		"occasions",
																	].includes(fieldName);
																};

																const getMetadataRoute = (
																	fieldName: string,
																	newValue: string,
																) => {
																	switch (fieldName) {
																		case "manufacturer_color":
																		case "sparkys_color":
																			return `/metadata/colors/${encodeURIComponent(newValue)}`;
																		case "brand":
																			return `/metadata/manufacturers/${encodeURIComponent(newValue)}`;
																		case "size":
																			return `/metadata/sizes/${encodeURIComponent(newValue)}`;
																		case "bag_quantity":
																			return `/metadata/bagQuantities/${encodeURIComponent(newValue)}`;
																		case "distributors":
																			return `/metadata/distributors/${encodeURIComponent(newValue)}`;
																		case "product_type":
																			return `/metadata/productTypes/${encodeURIComponent(newValue)}`;
																		case "texture":
																			return `/metadata/textures/${encodeURIComponent(newValue)}`;
																		case "shape":
																			return `/metadata/shapes/${encodeURIComponent(newValue)}`;
																		case "occasions":
																			return `/metadata/occasions/${encodeURIComponent(newValue)}`;
																		default:
																			return null;
																	}
																};

																return (
																	<View
																		key={field}
																		style={[
																			styles.changeItem,
																			{ backgroundColor: colors.surface },
																		]}
																	>
																		<Ionicons
																			name={getFieldIcon(field) as any}
																			size={20}
																			color={colors.primary}
																		/>
																		<View style={styles.changeContent}>
																			<Text
																				style={[
																					styles.changeLabel,
																					{ color: colors.textSecondary },
																				]}
																			>
																				{field.replace(/_/g, " ").toUpperCase()}
																			</Text>
																			<Text
																				style={[
																					styles.changeValue,
																					{ color: colors.text },
																				]}
																			>
																				{oldValue?.toString() || "—"}
																			</Text>
																		</View>
																		{isClickableField(field) ? (
																			<Pressable
																				style={styles.changeArrowContainer}
																				onPress={() => {
																					const route = getMetadataRoute(
																						field,
																						newValue?.toString() || "",
																					);
																					if (route) {
																						setIsDetailModalVisible(false);
																						router.push(route);
																					}
																				}}
																			>
																				<Ionicons
																					name="arrow-forward"
																					size={16}
																					color={colors.primary}
																				/>
																				<Text
																					style={[
																						styles.changeNewValue,
																						{ color: colors.primary },
																					]}
																				>
																					{newValue?.toString() || "—"}
																				</Text>
																			</Pressable>
																		) : (
																			<View style={styles.changeArrowContainer}>
																				<Ionicons
																					name="arrow-forward"
																					size={16}
																					color={colors.textSecondary}
																				/>
																				<Text
																					style={[
																						styles.changeNewValue,
																						{ color: colors.text },
																					]}
																				>
																					{newValue?.toString() || "—"}
																				</Text>
																			</View>
																		)}
																	</View>
																);
															})}
														</View>
													);
												} catch (e) {
													return (
														<Text
															style={[
																styles.changesText,
																{ color: colors.textSecondary },
															]}
														>
															{selectedEvent.changes}
														</Text>
													);
												}
											})()}
										</View>
									)}

								<Pressable
									style={[
										styles.viewItemButton,
										{ backgroundColor: colors.primary },
									]}
									onPress={() => navigateToItem(selectedEvent)}
								>
									<Ionicons name="open-outline" size={20} color="white" />
									<Text style={styles.viewItemText}>View Item</Text>
								</Pressable>
							</View>
						</View>
					)}
				</SafeAreaView>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		gap: 16,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	eventsList: {
		flex: 1,
	},
	eventsListContent: {
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 12,
	},
	eventCard: {
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		borderWidth: 1,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	eventHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	eventInfo: {
		flex: 1,
	},
	eventTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 4,
	},
	eventType: {
		fontSize: 14,
		fontWeight: "600",
	},
	objectType: {
		fontSize: 12,
		textTransform: "uppercase",
		fontWeight: "500",
	},
	objectName: {
		fontSize: 16,
		fontWeight: "500",
		marginBottom: 4,
	},
	timestamp: {
		fontSize: 12,
	},
	loadingFooter: {
		padding: 16,
		alignItems: "center",
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 60,
	},
	emptyText: {
		fontSize: 16,
		marginTop: 12,
		textAlign: "center",
	},
	modalContainer: {
		flex: 1,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "bold",
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	detailContent: {
		flex: 1,
		padding: 16,
	},
	detailCard: {
		borderRadius: 12,
		padding: 20,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	detailHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	detailEventType: {
		fontSize: 18,
		fontWeight: "600",
	},
	detailObjectName: {
		fontSize: 20,
		fontWeight: "bold",
		marginBottom: 4,
	},
	detailObjectType: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
		marginBottom: 8,
	},
	detailTimestamp: {
		fontSize: 14,
		marginBottom: 8,
	},
	detailUserEmail: {
		fontSize: 12,
		fontStyle: "italic",
		marginBottom: 20,
	},
	changesSection: {
		marginBottom: 20,
	},
	changesTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: 8,
	},
	changesText: {
		fontSize: 14,
		fontFamily: "monospace",
		backgroundColor: "#f8f9fa",
		padding: 12,
		borderRadius: 8,
	},
	changesGrid: {
		gap: 12,
		marginTop: 8,
	},
	changeItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderRadius: 8,
		gap: 12,
	},
	changeContent: {
		flex: 1,
	},
	changeLabel: {
		fontSize: 12,
		textTransform: "uppercase",
		fontWeight: "500",
		marginBottom: 2,
	},
	changeValue: {
		fontSize: 16,
		fontWeight: "500",
	},
	changeArrowContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	changeNewValue: {
		fontSize: 16,
		fontWeight: "600",
	},
	viewItemButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	viewItemText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
});
