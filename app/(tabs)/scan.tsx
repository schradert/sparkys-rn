import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, StyleSheet, Text, View } from "react-native";

export default function Scan() {
	const [permission, requestPermission] = useCameraPermissions();

	if (!permission) return <View />;

	if (!permission.granted) {
		return (
			<View style={styles.container}>
				<Text style={{ textAlign: "center" }}>
					We need your permission to use the camera
				</Text>
				<Button onPress={requestPermission} title="Grant permission" />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<CameraView
				style={styles.camera}
				barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
				onBarcodeScanned={({ data }) => alert(data)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
	},
	camera: {
		flex: 1,
		width: "100%",
	},
});
