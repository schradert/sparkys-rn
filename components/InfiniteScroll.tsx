import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Animated,
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
	type ViewToken,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface InfiniteScrollProps<T> {
	data: T[];
	renderItem: ({ item }: { item: T }) => React.ReactElement;
	keyExtractor: (item: T) => string;
	emptyText?: string;
	itemsPerLoad?: number;
	onRefresh?: () => void;
	refreshing?: boolean;
}

export default function InfiniteScroll<T>({
	data,
	renderItem,
	keyExtractor,
	emptyText = "No items",
	itemsPerLoad = 20,
	onRefresh,
	refreshing = false,
}: InfiniteScrollProps<T>) {
	const [visibleCount, setVisibleCount] = useState(itemsPerLoad);
	const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
	const [showScrollOverlay, setShowScrollOverlay] = useState(false);
	const { theme } = useTheme();
	const colors = Colors[theme];

	const flatListRef = useRef<FlatList>(null);
	const [overlayOpacity] = useState(() => new Animated.Value(0));
	const hideOverlayTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const visibleData = data.slice(0, visibleCount);
	const hasMore = visibleCount < data.length;

	const loadMore = () => {
		if (hasMore) {
			setVisibleCount((prev) => Math.min(prev + itemsPerLoad, data.length));
		}
	};

	const showOverlay = () => {
		setShowScrollOverlay(true);
		overlayOpacity.setValue(1); // Set to fully visible immediately

		// Clear existing timeout
		if (hideOverlayTimeout.current) {
			clearTimeout(hideOverlayTimeout.current);
		}

		// Hide overlay after 1 second
		hideOverlayTimeout.current = setTimeout(() => {
			Animated.timing(overlayOpacity, {
				toValue: 0,
				duration: 300,
				useNativeDriver: true,
			}).start(() => {
				setShowScrollOverlay(false);
			});
		}, 1000);
	};

	const onScroll = () => {
		showOverlay(); // Call directly without requestAnimationFrame
	};

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: ViewToken[] }) => {
			if (viewableItems.length > 0) {
				const firstVisible = viewableItems[0].index ?? 0;
				setFirstVisibleIndex(firstVisible);
			}
		},
		[],
	);

	const jumpToStart = () => {
		flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
		showOverlay();
	};

	const jumpToEnd = () => {
		flatListRef.current?.scrollToEnd({ animated: true });
		showOverlay();
	};

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (hideOverlayTimeout.current) {
				clearTimeout(hideOverlayTimeout.current);
			}
		};
	}, []);

	const renderFooter = () => {
		if (!hasMore) return null;

		return (
			<View
				style={[styles.footerContainer, { backgroundColor: colors.background }]}
			>
				<Text style={[styles.footerText, { color: colors.textSecondary }]}>
					Loading more items...
				</Text>
			</View>
		);
	};

	const renderEmpty = () => {
		return (
			<View style={styles.emptyContainer}>
				<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
					{emptyText}
				</Text>
			</View>
		);
	};

	// Reset visible count when data changes
	const handleRefresh = () => {
		setVisibleCount(itemsPerLoad);
		onRefresh?.();
	};

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<FlatList
				ref={flatListRef}
				data={visibleData}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				ListEmptyComponent={renderEmpty}
				ListFooterComponent={renderFooter}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.listContainer}
				onEndReached={loadMore}
				onEndReachedThreshold={0.1}
				onScroll={onScroll}
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={{
					itemVisiblePercentThreshold: 50,
				}}
				refreshControl={
					onRefresh ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={handleRefresh}
							colors={[colors.primary]}
							tintColor={colors.primary}
						/>
					) : undefined
				}
			/>

			{showScrollOverlay && (
				<Animated.View
					style={[
						styles.scrollOverlay,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							opacity: overlayOpacity,
						},
					]}
				>
					<Pressable
						style={[styles.jumpButton, { backgroundColor: colors.primary }]}
						onPress={jumpToStart}
					>
						<Ionicons name="chevron-up-outline" size={16} color="white" />
					</Pressable>

					<Text style={[styles.positionText, { color: colors.text }]}>
						{firstVisibleIndex + 1} / {data.length}
					</Text>

					<Pressable
						style={[styles.jumpButton, { backgroundColor: colors.primary }]}
						onPress={jumpToEnd}
					>
						<Ionicons name="chevron-down-outline" size={16} color="white" />
					</Pressable>
				</Animated.View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	listContainer: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		flexGrow: 1,
	},
	emptyContainer: {
		padding: 40,
		alignItems: "center",
	},
	emptyText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#6c757d",
		textAlign: "center",
	},
	footerContainer: {
		paddingVertical: 20,
		alignItems: "center",
	},
	footerText: {
		fontSize: 14,
		color: "#6c757d",
		fontStyle: "italic",
	},
	scrollOverlay: {
		position: "absolute",
		top: "50%",
		right: 20,
		flexDirection: "column",
		alignItems: "center",
		backgroundColor: "white",
		borderRadius: 20,
		paddingVertical: 12,
		paddingHorizontal: 8,
		borderWidth: 1,
		borderColor: "#dee2e6",
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		transform: [{ translateY: -50 }],
	},
	jumpButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#007bff",
		justifyContent: "center",
		alignItems: "center",
		marginVertical: 4,
	},
	positionText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#1a1a1a",
		marginVertical: 8,
		textAlign: "center",
	},
});
