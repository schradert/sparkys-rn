import type { ImageSourcePropType } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";

type Props = {
	imageSize: number;
	stickerSource: ImageSourcePropType;
};

export default function EmojiSticker({ imageSize, stickerSource }: Props) {
	const scaleImage = useSharedValue(imageSize);
	const translateX = useSharedValue(0);
	const translateY = useSharedValue(0);
	const imageStyle = useAnimatedStyle(() => {
		return {
			width: withSpring(scaleImage.value),
			height: withSpring(scaleImage.value),
		};
	});
	const containerStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{
					translateX: translateX.value,
				},
				{
					translateY: translateY.value,
				},
			],
		};
	});

	const doubleTap = Gesture.Tap()
		.numberOfTaps(2)
		.onStart(() => {
			scaleImage.value =
				scaleImage.value !== imageSize * 2
					? scaleImage.value * 2
					: Math.round(scaleImage.value / 2);
		});
	const drag = Gesture.Pan().onChange((event) => {
		translateX.value += event.changeX;
		translateY.value += event.changeY;
	});

	return (
		<GestureDetector gesture={drag}>
			<Animated.View style={[containerStyle, { top: -350 }]}>
				<GestureDetector gesture={doubleTap}>
					<Animated.Image
						source={stickerSource}
						resizeMode="contain"
						style={[imageStyle, { width: imageSize, height: imageSize }]}
					/>
				</GestureDetector>
			</Animated.View>
		</GestureDetector>
	);
}
