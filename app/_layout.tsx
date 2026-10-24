import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { AppProvider } from "../src/state/react";
export default function Layout() {
  const [loaded, error] = useFonts({
    Inter: require("../assets/fonts/Inter.ttf"),
    JetBrainsMono: require("../assets/fonts/JetBrainsMono-Regular.ttf"),
  });
  if (!loaded && !error)
    return <View style={{ flex: 1, backgroundColor: "#181817" }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {error && (
        <Text style={{ color: "#FF8B81", backgroundColor: "#181817" }}>
          Bundled fonts could not load. Using system text.
        </Text>
      )}
      <AppProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#181817" },
            animation: "none",
          }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}
