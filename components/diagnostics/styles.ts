import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
	list: {
		flex: 1,
	},
	listContent: {
		padding: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: 4,
	},
	sectionHint: {
		fontSize: 13,
		marginBottom: 12,
		lineHeight: 18,
	},
	scopeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		marginBottom: 8,
	},
	scopeText: {
		flex: 1,
	},
	scopeLabel: {
		fontSize: 15,
		fontWeight: "500",
	},
	scopeHint: {
		fontSize: 12,
		marginTop: 2,
	},
	uploadButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 14,
		borderRadius: 8,
		marginTop: 8,
	},
	uploadButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
	resultBox: {
		marginTop: 12,
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
	},
	resultText: {
		fontSize: 14,
	},
	shareRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 8,
	},
	shareText: {
		fontSize: 14,
		fontWeight: "600",
	},
	recentHeaderRow: {
		marginTop: 24,
		marginBottom: 8,
	},
	filterRow: {
		flexDirection: "row",
		gap: 8,
		marginTop: 8,
	},
	filterChip: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
	},
	filterChipText: {
		fontSize: 13,
		fontWeight: "500",
	},
	logRow: {
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	logHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	logLevel: {
		fontSize: 11,
		fontWeight: "700",
		width: 44,
	},
	logTag: {
		fontSize: 12,
		fontWeight: "600",
		flex: 1,
	},
	logTime: {
		fontSize: 11,
	},
	logMsg: {
		fontSize: 13,
		marginTop: 2,
	},
	logCtx: {
		fontSize: 11,
		fontFamily: "monospace",
		marginTop: 2,
	},
	emptyText: {
		fontSize: 14,
		textAlign: "center",
		paddingVertical: 24,
	},
});
