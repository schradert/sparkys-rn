/** Themed pressable button used for primary and default actions. */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** Props for {@link Button}: a label, optional `"primary"` theme, and tap handler. */
type Props = {
	label: string;
	theme?: "primary";
	onPress?: () => void;
};

/** A tappable button; the `"primary"` theme adds a gold border and image icon. */
export default function Button({ label, theme, onPress }: Props) {
	const isPrimary = theme === "primary";
	return (
		<View
			style={[
				styles.buttonContainer,
				!isPrimary
					? {}
					: {
							borderWidth: 4,
							borderColor: "#ffd33d",
							borderRadius: 18,
						},
			]}
		>
			<Pressable
				onPress={onPress}
				style={[
					styles.button,
					!isPrimary
						? {}
						: {
								backgroundColor: "#fff",
							},
				]}
			>
				{isPrimary && (
					<FontAwesome
						name="picture-o"
						size={18}
						color="#25292e"
						style={styles.buttonIcon}
					/>
				)}
				<Text
					style={[
						styles.buttonLabel,
						!isPrimary
							? {}
							: {
									color: "#25292e",
								},
					]}
				>
					{label}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	buttonContainer: {
		width: 320,
		height: 68,
		marginHorizontal: 20,
		alignItems: "center",
		justifyContent: "center",
		padding: 3,
	},
	button: {
		borderRadius: 10,
		width: "100%",
		height: "100%",
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
	},
	buttonIcon: {
		paddingRight: 8,
	},
	buttonLabel: {
		color: "#fff",
		fontSize: 16,
	},
});
