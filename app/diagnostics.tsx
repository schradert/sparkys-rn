import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEVEL_RANK } from "@/components/diagnostics/diagnosticsFormat";
import { LogRow } from "@/components/diagnostics/LogRow";
import { styles } from "@/components/diagnostics/styles";
import { UploadPanel } from "@/components/diagnostics/UploadPanel";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useLogs } from "@/hooks/useLogs";
import { useTheme } from "@/hooks/useTheme";
import type { LogEntry, LogLevel } from "@/services/logger";
import type { LogScope } from "@/services/logger/collect";
import { type UploadResult, uploadDiagnostics } from "@/services/logger/upload";

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
		/* istanbul ignore next -- unreachable false arm: the share affordance only renders when result.ok && result.link are already truthy */
		if (result?.ok && result.link) {
			try {
				await Share.share({ message: result.link, url: result.link });
			} catch {
				// User dismissed the share sheet — nothing to do.
			}
		}
	};

	const renderEntry = ({ item }: { item: LogEntry }) => (
		<LogRow item={item} colors={colors} />
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
					<UploadPanel
						colors={colors}
						scope={scope}
						setScope={setScope}
						uploading={uploading}
						onUpload={onUpload}
						result={result}
						onShareLink={onShareLink}
						filter={filter}
						setFilter={setFilter}
					/>
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
