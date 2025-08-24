const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";
const baseId = "com.sparkysballoons.invx";
const baseName = "InvX";
const suffix = IS_DEV ? ".dev" : IS_PREVIEW ? ".preview" : "";
const id = `${baseId}${suffix}`;
const heading = IS_DEV
	? " (Dev)"
	: IS_PREVIEW
		? " (Preview)"
		: ": Sparky's Inventory";
const name = `${baseName}${heading}`;

export default ({ config }) => ({
	...config,
	name: name,
	ios: {
		...config.ios,
		bundleIdentifier: id,
	},
	android: {
		...config.android,
		package: id,
	},
});
