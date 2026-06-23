import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ThemeColors } from "@/constants/Colors";
import type { LogLevel } from "@/services/logger";
import { LOG_SCOPES, type LogScope } from "@/services/logger/collect";
import type { UploadResult } from "@/services/logger/upload";
import { LEVEL_FILTERS } from "./diagnosticsFormat";
import { styles } from "./styles";

/**
 * Diagnostics upload controls: pick a log scope, upload to Drive, surface the
 * result with a share link, and filter the recent-logs list by level.
 */
export function UploadPanel({
	colors,
	scope,
	setScope,
	uploading,
	onUpload,
	result,
	onShareLink,
	filter,
	setFilter,
}: {
	colors: ThemeColors;
	scope: LogScope;
	setScope: (scope: LogScope) => void;
	uploading: boolean;
	onUpload: () => void;
	result: UploadResult | null;
	onShareLink: () => void;
	filter: LogLevel | "all";
	setFilter: (filter: LogLevel | "all") => void;
}) {
	return (
		<View>
			<Text style={[styles.sectionTitle, { color: colors.text }]}>
				Upload logs to Google Drive
			</Text>
			<Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
				Logs stay on this device. Pick what to include and upload to the shared
				diagnostics folder so the developer can investigate.
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
							<Text style={[styles.scopeHint, { color: colors.textSecondary }]}>
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
					<Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
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
							<Ionicons name="share-outline" size={18} color={colors.primary} />
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
										backgroundColor: active ? colors.primary : colors.surface,
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
	);
}
