/** Web override of `useColorScheme` that is hydration-safe for static render. */

import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * The color scheme on web. Returns `"light"` until the client has hydrated, then
 * the real scheme, so static-rendered markup matches the first client paint.
 */
export function useColorScheme() {
	const [hasHydrated, setHasHydrated] = useState(false);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration flag required for web static rendering
		setHasHydrated(true);
	}, []);

	const colorScheme = useRNColorScheme();

	if (hasHydrated) {
		return colorScheme;
	}

	return "light";
}
