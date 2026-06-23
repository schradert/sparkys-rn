/** Single log entry row for the diagnostics list. */
import { Text, View } from "react-native";
import type { ThemeColors } from "@/constants/Colors";
import type { LogEntry } from "@/services/logger";
import { getLevelColor, safeStringify } from "./diagnosticsFormat";
import { styles } from "./styles";

/** Renders one {@link LogEntry}: level, tag, time, message, and optional context. */
export function LogRow({
	item,
	colors,
}: {
	item: LogEntry;
	colors: ThemeColors;
}) {
	return (
		<View style={[styles.logRow, { borderBottomColor: colors.separator }]}>
			<View style={styles.logHeaderRow}>
				<Text
					style={[
						styles.logLevel,
						{ color: getLevelColor(item.level, colors) },
					]}
				>
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
}
