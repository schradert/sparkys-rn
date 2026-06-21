import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	Share,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useLogs } from "@/hooks/useLogs";
import { useTheme } from "@/hooks/useTheme";
import type { LogEntry, LogLevel } from "@/services/logger";
import { LOG_SCOPES, type LogScope } from "@/services/logger/collect";
import { type UploadResult, uploadDiagnostics } from "@/services/logger/upload";

const LEVEL_RANK: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

const LEVEL_FILTERS: { key: LogLevel | "all"; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "info", label: "Info+" },
	{ key: "warn", label: "Warn+" },
	{ key: "error", label: "Error" },
];

export default function Diagnostics() {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const { user, getDriveAccessToken } = useAuth();
	const { entries } = useLogs();

	const [scope, setScope] = useState<LogScope>("session");
	const [filter, setFilter] = useState<LogLevel | "all">("all");
	const [uploading, setUploading] = useState(false);
	const [result, setResult] = useState<UploadResult | null>(null);

	const userEmail = user?.user?.email ?? undefined;

	const visible = useMemo(() => {
		const min = filter === "all" ? 0 : LEVEL_RANK[filter];
		return entries
			.filter((e) => LEVEL_RANK[e.level] >= min)
			.slice()
			.reverse(); // newest first
	}, [entries, filter]);

	const levelColor = (level: LogLevel): string => {
		switch (level) {
			case "error":
				return colors.error;
			case "warn":
				return colors.warning;
			case "info":
				return colors.primary;
			default:
				return colors.textMuted;
		}
	};

	const onUpload = async () => {
		setUploading(true);
		setResult(null);
		const res = await uploadDiagnostics(scope, getDriveAccessToken, {
			userEmail,
		});
		setResult(res);
		setUploading(false);
	};

	const onShareLink = async () => {
		if (result?.ok && result.link) {
			try {
				await Share.share({ message: result.link, url: result.link });
			} catch {
				// User dismissed the share sheet — nothing to do.
			}
		}
	};

	const renderEntry = ({ item }: { item: LogEntry }) => (
		<View style={[styles.logRow, { borderBottomColor: colors.separator }]}>
			<View style={styles.logHeaderRow}>
				<Text style={[styles.logLevel, { color: levelColor(item.level) }]}>
					{item.level.toUpperCase()}
				</Text>
				<Text style={[styles.logTag, { color: colors.textSecondary }]}>
					{item.tag}
				</Text>
				<Text style={[styles.logTime, { color: colors.textMuted }]}>
					{new Date(item.t).toLocaleTimeString()}
				</Text>
			</View>
			<Text style={[styles.logMsg, { color: colors.text }]}>{item.msg}</Text>
			{item.ctx !== undefined && (
				<Text
					style={[styles.logCtx, { color: colors.textMuted }]}
					numberOfLines={3}
				>
					{safeStringify(item.ctx)}
				</Text>
			)}
		</View>
	);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
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
					Diagnostics
				</Text>
			</View>

			<FlatList
				data={visible}
				renderItem={renderEntry}
				keyExtractor={(item) => String(item.seq)}
				style={styles.list}
				contentContainerStyle={styles.listContent}
				ListHeaderComponent={
					<View>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>
							Upload logs to Google Drive
						</Text>
						<Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
							Logs stay on this device. Pick what to include and upload to the
							shared diagnostics folder so the developer can investigate.
						</Text>

						{LOG_SCOPES.map((s) => {
							const selected = scope === s.key;
							return (
								<Pressable
									key={s.key}
									style={[
										styles.scopeRow,
										{
											backgroundColor: selected
												? colors.selectedBackground
												: colors.surface,
											borderColor: selected ? colors.primary : colors.border,
										},
									]}
									onPress={() => setScope(s.key)}
								>
									<Ionicons
										name={selected ? "radio-button-on" : "radio-button-off"}
										size={20}
										color={selected ? colors.primary : colors.textMuted}
									/>
									<View style={styles.scopeText}>
										<Text style={[styles.scopeLabel, { color: colors.text }]}>
											{s.label}
										</Text>
										<Text
											style={[
												styles.scopeHint,
												{ color: colors.textSecondary },
											]}
										>
											{s.hint}
										</Text>
									</View>
								</Pressable>
							);
						})}

						<Pressable
							style={[
								styles.uploadButton,
								{
									backgroundColor: colors.primary,
									opacity: uploading ? 0.6 : 1,
								},
							]}
							onPress={onUpload}
							disabled={uploading}
						>
							{uploading ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<Ionicons
									name="cloud-upload-outline"
									size={20}
									color="#ffffff"
								/>
							)}
							<Text style={styles.uploadButtonText}>
								{uploading ? "Uploading…" : "Upload to Drive"}
							</Text>
						</Pressable>

						{result && (
							<View
								style={[
									styles.resultBox,
									{
										backgroundColor: result.ok
											? `${colors.success}20`
											: `${colors.error}20`,
										borderColor: result.ok ? colors.success : colors.error,
									},
								]}
							>
								<Text
									style={[
										styles.resultText,
										{ color: result.ok ? colors.success : colors.error },
									]}
								>
									{result.ok
										? `Uploaded ${result.fileName} (${result.entryCount} entries).`
										: result.error}
								</Text>
								{result.ok && result.link && (
									<Pressable onPress={onShareLink} style={styles.shareRow}>
										<Ionicons
											name="share-outline"
											size={18}
											color={colors.primary}
										/>
										<Text style={[styles.shareText, { color: colors.primary }]}>
											Share link
										</Text>
									</Pressable>
								)}
							</View>
						)}

						<View style={styles.recentHeaderRow}>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>
								Recent logs
							</Text>
							<View style={styles.filterRow}>
								{LEVEL_FILTERS.map((f) => {
									const active = filter === f.key;
									return (
										<Pressable
											key={f.key}
											onPress={() => setFilter(f.key)}
											style={[
												styles.filterChip,
												{
													backgroundColor: active
														? colors.primary
														: colors.surface,
													borderColor: active ? colors.primary : colors.border,
												},
											]}
										>
											<Text
												style={[
													styles.filterChipText,
													{ color: active ? "#ffffff" : colors.textSecondary },
												]}
											>
												{f.label}
											</Text>
										</Pressable>
									);
								})}
							</View>
						</View>
					</View>
				}
				ListEmptyComponent={
					<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
						No log entries yet.
					</Text>
				}
			/>
		</SafeAreaView>
	);
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
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
