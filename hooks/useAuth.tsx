import {
	GoogleSignin,
	isSuccessResponse,
	type User,
} from "@react-native-google-signin/google-signin";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { getErrorMessage } from "@/services/errors";
import { logger } from "@/services/logger";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

interface AuthState {
	user: User | null;
	isLoading: boolean;
	isSignedIn: boolean;
}

let globalAuthState: AuthState = {
	user: null,
	isLoading: true,
	isSignedIn: false,
};

let authSubscribers: Array<() => void> = [];

function subscribeToAuth(callback: () => void) {
	authSubscribers.push(callback);
	return () => {
		authSubscribers = authSubscribers.filter((sub) => sub !== callback);
	};
}

function updateAuthState(newState: Partial<AuthState>) {
	globalAuthState = { ...globalAuthState, ...newState };
	authSubscribers.forEach((callback) => {
		callback();
	});
}

GoogleSignin.configure({
	// TODO how does this "just know" where the Android app is?!
	iosClientId:
		"420632028099-5mcpspf5p2gkdsr0p8hhabglvp1jbkeq.apps.googleusercontent.com",
	scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const initializeAuth = () => {
	const user = GoogleSignin.getCurrentUser();
	if (user) {
		updateAuthState({
			user,
			isSignedIn: true,
			isLoading: false,
		});
	} else {
		updateAuthState({
			user: null,
			isSignedIn: false,
			isLoading: false,
		});
	}
};

initializeAuth();

async function signIn(): Promise<{ success: boolean; error?: string }> {
	try {
		updateAuthState({ isLoading: true });

		await GoogleSignin.hasPlayServices();
		const response = await GoogleSignin.signIn();

		if (isSuccessResponse(response)) {
			updateAuthState({
				user: response.data,
				isSignedIn: true,
				isLoading: false,
			});
			return { success: true };
		} else {
			// Cancelled
			updateAuthState({
				user: null,
				isSignedIn: false,
				isLoading: false,
			});
			return { success: false };
		}
	} catch (error) {
		updateAuthState({
			user: null,
			isSignedIn: false,
			isLoading: false,
		});
		return {
			success: false,
			error: getErrorMessage(error) || "Sign in failed",
		};
	}
}

async function signOut(): Promise<void> {
	try {
		await GoogleSignin.signOut();
		updateAuthState({
			user: null,
			isSignedIn: false,
			isLoading: false,
		});
	} catch (error) {
		logger.error("Auth", "Sign out error", { error });
	}
}

let tokenPromise: Promise<string | null> | null = null;

async function getAccessToken(): Promise<string | null> {
	if (tokenPromise) {
		return tokenPromise;
	}

	tokenPromise = (async () => {
		try {
			const tokens = await GoogleSignin.getTokens();
			return tokens.accessToken;
		} catch (error) {
			logger.error("Auth", "Get access token error", { error });
			return null;
		} finally {
			tokenPromise = null;
		}
	})();

	return tokenPromise;
}

/**
 * Get an access token that includes the Drive scope, requesting it just-in-time
 * via incremental consent (so users who never upload diagnostics are never
 * prompted for Drive). On Android the cached token is cleared after `addScopes`
 * so the refreshed token actually reflects the new scope — otherwise Drive
 * calls 403 with a stale, pre-elevation token. Returns null if no token can be
 * obtained; if the user declines Drive consent the upload will surface a 403.
 */
export async function getDriveAccessToken(): Promise<string | null> {
	try {
		await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
	} catch (error) {
		logger.warn("Auth", "addScopes(drive) failed; trying existing token", {
			error,
		});
	}

	try {
		if (Platform.OS === "android") {
			try {
				const current = await GoogleSignin.getTokens();
				if (current?.accessToken) {
					await GoogleSignin.clearCachedAccessToken(current.accessToken);
				}
			} catch {
				// Best effort — fall through to a fresh getTokens().
			}
		}
		const tokens = await GoogleSignin.getTokens();
		return tokens.accessToken ?? null;
	} catch (error) {
		logger.error("Auth", "Failed to obtain Drive access token", { error });
		return null;
	}
}

export function useAuth() {
	const [, forceUpdate] = useState({});

	useEffect(() => {
		return subscribeToAuth(() => forceUpdate({}));
	}, []);

	return {
		...globalAuthState,
		signIn,
		signOut,
		getAccessToken,
		getDriveAccessToken,
	};
}
