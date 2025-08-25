import {
	GoogleSignin,
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

const initializeAuth = async () => {
	try {
		const isSignedIn = await GoogleSignin.isSignedIn();

		if (isSignedIn) {
			const user = await GoogleSignin.getCurrentUser();
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
	} catch (error) {
		console.error("Auth initialization error:", error);
		updateAuthState({
			user: null,
			isSignedIn: false,
			isLoading: false,
		});
	}
};

initializeAuth();

const signIn = async (): Promise<{ success: boolean; error?: string }> => {
	try {
		updateAuthState({ isLoading: true });

		await GoogleSignin.hasPlayServices();
		const user = await GoogleSignin.signIn();

		updateAuthState({
			user,
			isSignedIn: true,
			isLoading: false,
		});

		return { success: true };
	} catch (error) {
		console.error("Sign in error:", error);
		updateAuthState({
			user: null,
			isSignedIn: false,
			isLoading: false,
		});

		return { success: false, error: error.message || "Sign in failed" };
	}
};

const signOut = async (): Promise<void> => {
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
};

const getAccessToken = async (): Promise<string | null> => {
	try {
		const tokens = await GoogleSignin.getTokens();
		return tokens.accessToken;
	} catch (error) {
		console.error("Get access token error:", error);
		return null;
	}
};

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
