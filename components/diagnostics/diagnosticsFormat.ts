import type { ThemeColors } from "@/constants/Colors";
import type { LogLevel } from "@/services/logger";

export const LEVEL_RANK: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export const LEVEL_FILTERS: { key: LogLevel | "all"; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "info", label: "Info+" },
	{ key: "warn", label: "Warn+" },
	{ key: "error", label: "Error" },
];

export function getLevelColor(level: LogLevel, colors: ThemeColors): string {
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
}

export function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
