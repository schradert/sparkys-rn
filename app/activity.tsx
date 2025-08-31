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

	const getEventIcon = (eventType: string, objectType: string) => {
		switch (eventType) {
			case "create":
				return "add-circle-outline";
			case "edit":
				return "pencil-outline";
			case "archive":
				return "archive-outline";
			case "unarchive":
				return "refresh-outline";
			default:
				return "information-circle-outline";
		}
	};

	const getEventColor = (eventType: string) => {
		switch (eventType) {
			case "create":
				return colors.success;
			case "edit":
				return colors.primary;
			case "archive":
				return colors.error;
			case "unarchive":
				return colors.success;
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
							name={getEventIcon(item.event_type, item.object_type)}
							size={20}
							color={getEventColor(item.event_type)}
						/>
						<Text
							style={[
								styles.eventType,
								{ color: getEventColor(item.event_type) },
							]}
						>
							{item.event_type.charAt(0).toUpperCase() +
								item.event_type.slice(1)}
							d
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
										)}
										size={24}
										color={getEventColor(selectedEvent.event_type)}
									/>
									<Text
										style={[
											styles.detailEventType,
											{ color: getEventColor(selectedEvent.event_type) },
										]}
									>
										{selectedEvent.event_type.charAt(0).toUpperCase() +
											selectedEvent.event_type.slice(1)}
										d {selectedEvent.object_type.replace("_", " ")}
									</Text>
								</View>

								<Text style={[styles.detailObjectName, { color: colors.text }]}>
									{selectedEvent.object_name}
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

								{selectedEvent.changes && selectedEvent.changes !== "{}" && (
									<View style={styles.changesSection}>
										<Text style={[styles.changesTitle, { color: colors.text }]}>
											Changes:
										</Text>
										<Text
											style={[
												styles.changesText,
												{ color: colors.textSecondary },
											]}
										>
											{selectedEvent.changes}
										</Text>
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
		padding: 16,
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
