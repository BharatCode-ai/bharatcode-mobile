import type { ExpoConfig } from "expo/config";

// Optional, explicit CI build number; never guess the next store build number.
const internalBuildNumber = process.env.BC_INTERNAL_BUILD_NUMBER;
if (
  internalBuildNumber !== undefined &&
  !/^[1-9][0-9]{0,3}$/.test(internalBuildNumber)
) {
  throw new Error("BC_INTERNAL_BUILD_NUMBER must be an integer from 1 to 9999");
}

const config: ExpoConfig = {
  name: "BharatCode",
  slug: "bharatcode-mobile",
  version: "0.2.0",
  scheme: "bharatcode",
  icon: "./assets/brand/bharatcode.png",
  orientation: "default",
  userInterfaceStyle: "dark",
  android: {
    package: "ai.bharatcode.bharatcode_mobile",
    ...(internalBuildNumber ? { versionCode: Number(internalBuildNumber) } : {}),
    permissions: ["CAMERA"],
    softwareKeyboardLayoutMode: "resize",
  },
  ios: {
    bundleIdentifier: "ai.bharatcode.bharatcodeMobile",
    ...(internalBuildNumber ? { buildNumber: internalBuildNumber } : {}),
    supportsTablet: true,
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission:
          "Scan a pairing QR from BharatCode Desktop to connect this phone.",
        recordAudioAndroid: false,
      },
    ],
    ["expo-secure-store", { configureAndroidBackup: true }],
    "expo-sqlite",
    "expo-font",
    "expo-asset",
    "expo-status-bar",
  ],
  web: { bundler: "metro" },
};
export default config;
