import { StyleSheet, Text, TextInput, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface AddMetadataFormProps {
	/** Singular noun for the current metadata view, e.g. "Product Type". */
	singularLabel: string;
	value: string;
	onChangeValue: (value: string) => void;
}

/** The add-metadata form body: a single labeled value input. */
export default function AddMetadataForm({
	singularLabel,
	value,
	onChangeValue,
}: AddMetadataFormProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<>
			<Text style={[styles.sectionTitle, { color: colors.text }]}>
				Add New Value
			</Text>

			<View style={styles.inputGroup}>
				<Text style={[styles.inputLabel, { color: colors.text }]}>
					{singularLabel} Name
				</Text>
				<TextInput
					style={[
						styles.textInput,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.text,
						},
					]}
					value={value}
					onChangeText={onChangeValue}
					placeholder={`Enter ${singularLabel.toLowerCase()} name`}
					placeholderTextColor={colors.textSecondary}
					autoFocus
				/>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginBottom: 16,
	},
	inputGroup: {
		marginBottom: 16,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#495057",
		marginBottom: 8,
	},
	textInput: {
		borderWidth: 1,
		borderColor: "#dee2e6",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		backgroundColor: "white",
		color: "#495057",
	},
});
