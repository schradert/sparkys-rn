import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import { logger } from "@/services/logger";

interface BarcodeScannerModalProps {
	visible: boolean;
	onClose: () => void;
	onBarcodeScanned: (data: string) => void;
}

/** The full-screen EAN-13 barcode scanner used to add/look up external products. */
export default function BarcodeScannerModal({
	visible,
	onClose,
	onBarcodeScanned,
}: BarcodeScannerModalProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="fullScreen"
			onRequestClose={onClose}
		>
			<SafeAreaView
				style={[
					styles.scannerContainer,
					{ backgroundColor: colors.cardBackground },
				]}
			>
				<View
					style={[
						styles.scannerHeader,
						{ backgroundColor: colors.cardBackground },
					]}
				>
					<Text style={[styles.scannerTitle, { color: colors.text }]}>
						Scan Barcode
					</Text>
					<Pressable
						onPress={onClose}
						style={[styles.closeButton, { backgroundColor: colors.surface }]}
					>
						<Ionicons name="close" size={24} color={colors.text} />
					</Pressable>
				</View>
				<CameraView
					style={styles.camera}
					barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
					onBarcodeScanned={({ data }) => onBarcodeScanned(data)}
					onMountError={(event) =>
						logger.error("Inventory", "Camera failed to mount", { event })
					}
				/>
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	scannerContainer: {
		flex: 1,
		backgroundColor: "#000",
	},
	scannerHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderBottomWidth: 1,
	},
	scannerTitle: {
		fontSize: 20,
		fontWeight: "bold",
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	camera: {
		flex: 1,
	},
});
