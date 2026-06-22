import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/constants/Colors";
import type { AuditEvent } from "@/services/googleSheets";
import { getAllInternalProducts } from "@/store/products";
import {
	getBadgeDiff,
	getFieldIcon,
	getMetadataRoute,
	isBadgeField,
	isClickableField,
} from "./eventPresentation";

/** A read-only set of badges (constant/removed/added) for a diffed field. */
function BadgeList({
	oldValue,
	newValue,
	colors,
}: {
	oldValue: unknown;
	newValue: unknown;
	colors: ThemeColors;
}) {
	const { constant, removed, added } = getBadgeDiff(oldValue, newValue);
	return (
		<View style={styles.badgeContainer}>
			{constant.map((item) => (
				<View
					key={`constant-${item}`}
					style={[
						styles.badge,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
				>
					<Text style={[styles.badgeText, { color: colors.text }]}>{item}</Text>
				</View>
			))}
			{removed.map((item) => (
				<View
					key={`removed-${item}`}
					style={[
						styles.badge,
						{ backgroundColor: `${colors.error}20`, borderColor: colors.error },
					]}
				>
					<Text style={[styles.badgeText, { color: colors.error }]}>
						{item}
					</Text>
				</View>
			))}
			{added.map((item) => (
				<View
					key={`added-${item}`}
					style={[
						styles.badge,
						{
							backgroundColor: `${colors.success}20`,
							borderColor: colors.success,
						},
					]}
				>
					<Text style={[styles.badgeText, { color: colors.success }]}>
						{item}
					</Text>
				</View>
			))}
		</View>
	);
}

/** One change-field row: label, old value (or badges), and the new value. */
function ChangeRow({
	field,
	oldValue,
	newValue,
	colors,
	onNavigate,
}: {
	field: string;
	oldValue: unknown;
	newValue: unknown;
	colors: ThemeColors;
	onNavigate: (route: string) => void;
}) {
	const isBadge = isBadgeField(field);
	const newValueText = newValue?.toString() || "—";
	return (
		<View style={[styles.changeItem, { backgroundColor: colors.surface }]}>
			<Ionicons name={getFieldIcon(field)} size={20} color={colors.primary} />
			<View style={styles.changeContent}>
				<Text style={[styles.changeLabel, { color: colors.textSecondary }]}>
					{field.replace(/_/g, " ").toUpperCase()}
				</Text>
				{isBadge ? (
					<BadgeList oldValue={oldValue} newValue={newValue} colors={colors} />
				) : (
					<Text style={[styles.changeValue, { color: colors.text }]}>
						{oldValue?.toString() || "—"}
					</Text>
				)}
			</View>
			{!isBadge &&
				(isClickableField(field) ? (
					<Pressable
						style={styles.changeArrowContainer}
						onPress={() => {
							const route = getMetadataRoute(
								field,
								newValue?.toString() || "",
								getAllInternalProducts(),
							);
							if (route) {
								onNavigate(route);
							}
						}}
					>
						<Ionicons name="arrow-forward" size={16} color={colors.primary} />
						<Text style={[styles.changeNewValue, { color: colors.primary }]}>
							{newValueText}
						</Text>
					</Pressable>
				) : (
					<View style={styles.changeArrowContainer}>
						<Ionicons
							name="arrow-forward"
							size={16}
							color={colors.textSecondary}
						/>
						<Text style={[styles.changeNewValue, { color: colors.text }]}>
							{newValueText}
						</Text>
					</View>
				))}
		</View>
	);
}

/** The parsed changes grid, or the raw changes text when the JSON is invalid. */
export function ChangesSection({
	event,
	colors,
	onNavigate,
}: {
	event: AuditEvent;
	colors: ThemeColors;
	onNavigate: (route: string) => void;
}) {
	let changesObj: Record<string, unknown>;
	let beforeObj: Record<string, unknown>;
	try {
		changesObj = JSON.parse(event.changes);
		beforeObj = JSON.parse(event.before_state);
	} catch {
		return (
			<Text style={[styles.changesText, { color: colors.textSecondary }]}>
				{event.changes}
			</Text>
		);
	}

	return (
		<View style={styles.changesGrid}>
			{Object.keys(changesObj).map((field) => (
				<ChangeRow
					key={field}
					field={field}
					oldValue={beforeObj[field]}
					newValue={changesObj[field]}
					colors={colors}
					onNavigate={onNavigate}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
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
	badgeContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginTop: 4,
	},
	badge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: "500",
	},
});
