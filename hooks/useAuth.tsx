import {
	GoogleSignin,
	isSuccessResponse,
	type User,
} from "@react-native-google-signin/google-signin";
import { useEffect, useState } from "react";

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
	authSubscribers.forEach((callback) => callback());
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
	} catch (error: any) {
		updateAuthState({
			user: null,
			isSignedIn: false,
			isLoading: false,
		});
		return { success: false, error: error.message || "Sign in failed" };
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
		console.error("Sign out error:", error);
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
			console.error("Get access token error:", error);
			return null;
		} finally {
			tokenPromise = null;
		}
	})();

	return tokenPromise;
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
	};
}
