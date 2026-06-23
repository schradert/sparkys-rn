/** Route `/activity` — the audit-event feed. */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EventCard } from "@/components/activity/EventCard";
import { EventDetailModal } from "@/components/activity/EventDetailModal";
import { Colors } from "@/constants/Colors";
import { useAuditEvents } from "@/hooks/useAuditEvents";
import { useTheme } from "@/hooks/useTheme";
import type { AuditEvent } from "@/services/googleSheets";

/**
 * Route `/activity` — a paginated, pull-to-refresh list of audit events backed
 * by `useAuditEvents`; tapping a row opens its detail modal.
 */
export default function Activity() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
	const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

	const {
		events,
		isLoading: loading,
		isRefetching: refreshing,
		isFetchingNextPage: loadingMore,
		hasNextPage,
		fetchNextPage,
		refetch,
	} = useAuditEvents();

	const handleRefresh = () => {
		refetch();
	};

	const handleLoadMore = () => {
		if (hasNextPage && !loadingMore) {
			fetchNextPage();
		}
	};

	const handleEventPress = (event: AuditEvent) => {
		setSelectedEvent(event);
		setIsDetailModalVisible(true);
	};

	const renderFooter = () => {
		if (!loadingMore) return null;
		return (
			<View style={styles.loadingFooter}>
				<ActivityIndicator size="small" color={colors.primary} />
			</View>
		);
	};

	const renderHeader = () => (
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
			<Text style={[styles.headerTitle, { color: colors.text }]}>Activity</Text>
		</View>
	);

	if (loading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.cardBackground }]}
			>
				{renderHeader()}
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
		>
			{renderHeader()}

			<FlatList
				data={events}
				renderItem={({ item }) => (
					<EventCard event={item} colors={colors} onPress={handleEventPress} />
				)}
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

			<EventDetailModal
				event={selectedEvent}
				visible={isDetailModalVisible}
				colors={colors}
				onClose={() => setIsDetailModalVisible(false)}
			/>
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
});
