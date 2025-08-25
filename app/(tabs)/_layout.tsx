import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabLayout() {
	return (
		<SafeAreaView style={{ flex: 1 }} edges={["top"]}>
			<Tabs
				screenOptions={{
					tabBarActiveTintColor: "#ffd33d",
					headerShown: false,
					tabBarStyle: {
						backgroundColor: "#25292e",
					},
				}}
			>
				<Tabs.Screen
					name="index"
					options={{
						title: "Home",
						tabBarIcon: ({ color, focused }) => (
							<Ionicons
								name={focused ? "home-sharp" : "home-outline"}
								color={color}
								size={24}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="about"
					options={{
						title: "About",
						tabBarIcon: ({ color, focused }) => (
							<Ionicons
								name={
									focused ? "information-circle" : "information-circle-outline"
								}
								color={color}
								size={24}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="scan"
					options={{
						title: "Scan",
						tabBarIcon: ({ color, focused }) => (
							<Ionicons
								name={focused ? "barcode-sharp" : "barcode-outline"}
								color={color}
								size={24}
							/>
						),
					}}
				/>
				<Tabs.Screen
					name="inventory"
					options={{
						title: "Inventory",
						tabBarIcon: ({ color, focused }) => (
							<Ionicons
								name={focused ? "apps-sharp" : "apps-outline"}
								color={color}
								size={24}
							/>
						),
					}}
				/>
			</Tabs>
		</SafeAreaView>
	);
}
