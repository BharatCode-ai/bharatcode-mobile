import type { ExpoConfig } from "expo/config";
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
    permissions: ["CAMERA"],
  },
  ios: {
    bundleIdentifier: "ai.bharatcode.bharatcodeMobile",
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
