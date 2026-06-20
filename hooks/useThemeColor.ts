/**
 * Resolves a theme color for the active scheme, honoring optional
 * light/dark overrides passed by the caller.
 */

import { type ColorKey, Colors, toColorScheme } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export function useThemeColor(
	props: { light?: string; dark?: string },
	colorName: ColorKey,
) {
	const theme = toColorScheme(useColorScheme());
	const colorFromProps = props[theme];

	if (colorFromProps) {
		return colorFromProps;
	} else {
		return Colors[theme][colorName];
	}
}
