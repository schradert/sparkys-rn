import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/constants/Colors";
import type { AuditEvent } from "@/services/googleSheets";
import {
	formatTimestamp,
	getEventColor,
	getEventIcon,
	getEventLabel,
} from "./eventPresentation";

interface EventCardProps {
	event: AuditEvent;
	colors: ThemeColors;
	onPress: (event: AuditEvent) => void;
}

/** A single audit-event row in the activity feed. */
export function EventCard({ event, colors, onPress }: EventCardProps) {
	const accent = getEventColor(event, colors);
	return (
		<Pressable
			style={[
				styles.eventCard,
				{ backgroundColor: colors.cardBackground, borderColor: colors.border },
			]}
			onPress={() => onPress(event)}
		>
			<View style={styles.eventHeader}>
				<View style={styles.eventInfo}>
					<View style={styles.eventTitleRow}>
						<Ionicons name={getEventIcon(event)} size={20} color={accent} />
						<Text style={[styles.eventType, { color: accent }]}>
							{getEventLabel(event)}
						</Text>
						<Text style={[styles.objectType, { color: colors.textSecondary }]}>
							{event.object_type.replace("_", " ")}
						</Text>
					</View>
					<Text style={[styles.objectName, { color: colors.text }]}>
						{event.object_name}
					</Text>
					<Text style={[styles.timestamp, { color: colors.textSecondary }]}>
						{formatTimestamp(event.timestamp)} • {event.user_email}
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
}

const styles = StyleSheet.create({
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
});
