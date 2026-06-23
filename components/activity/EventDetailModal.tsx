import { Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ThemeColors } from "@/constants/Colors";
import type { AuditEvent } from "@/services/googleSheets";
import { ChangesSection } from "./EventChanges";
import {
	formatTimestamp,
	getEventColor,
	getEventIcon,
	getEventLabel,
	getItemRoute,
} from "./eventPresentation";

/** Props for {@link EventDetailModal}; a `null` `event` renders an empty sheet. */
interface EventDetailModalProps {
	event: AuditEvent | null;
	visible: boolean;
	colors: ThemeColors;
	onClose: () => void;
}

/** The detail card for a selected (non-null) event. */
function DetailBody({
	event,
	colors,
	onClose,
}: {
	event: AuditEvent;
	colors: ThemeColors;
	onClose: () => void;
}) {
	const navigateToItem = () => {
		onClose();
		const route = getItemRoute(event);
		if (route) {
			router.push(route as Href);
		}
	};

	const navigateToMetadata = (route: string) => {
		onClose();
		router.push(route as Href);
	};

	const hasChanges =
		!!event.changes &&
		event.changes !== "{}" &&
		!!event.before_state &&
		event.before_state !== "{}";

	return (
		<View style={styles.detailContent}>
			<View
				style={[styles.detailCard, { backgroundColor: colors.cardBackground }]}
			>
				<View style={styles.detailHeader}>
					<Ionicons
						name={getEventIcon(event)}
						size={24}
						color={getEventColor(event, colors)}
					/>
					<Text
						style={[
							styles.detailEventType,
							{ color: getEventColor(event, colors) },
						]}
					>
						{getEventLabel(event)}
					</Text>
				</View>

				<Text style={[styles.detailObjectName, { color: colors.text }]}>
					{event.object_name}
				</Text>

				<Text
					style={[styles.detailObjectType, { color: colors.textSecondary }]}
				>
					{event.object_type.replace("_", " ").toUpperCase()}
				</Text>

				<Text style={[styles.detailTimestamp, { color: colors.textSecondary }]}>
					{formatTimestamp(event.timestamp)}
				</Text>

				<Text style={[styles.detailUserEmail, { color: colors.textSecondary }]}>
					by {event.user_email}
				</Text>

				{hasChanges && (
					<View style={styles.changesSection}>
						<Text style={[styles.changesTitle, { color: colors.text }]}>
							Changes:
						</Text>
						<ChangesSection
							event={event}
							colors={colors}
							onNavigate={navigateToMetadata}
						/>
					</View>
				)}

				<Pressable
					style={[styles.viewItemButton, { backgroundColor: colors.primary }]}
					onPress={navigateToItem}
				>
					<Ionicons name="open-outline" size={20} color="white" />
					<Text style={styles.viewItemText}>View Item</Text>
				</Pressable>
			</View>
		</View>
	);
}

/** The slide-up detail sheet for a single audit event. */
export function EventDetailModal({
	event,
	visible,
	colors,
	onClose,
}: EventDetailModalProps) {
	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<SafeAreaView
				style={[styles.modalContainer, { backgroundColor: colors.background }]}
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
						onPress={onClose}
						style={[styles.closeButton, { backgroundColor: colors.surface }]}
					>
						<Ionicons name="close" size={24} color={colors.textSecondary} />
					</Pressable>
				</View>

				{event && (
					<DetailBody event={event} colors={colors} onClose={onClose} />
				)}
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create({
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
