import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { AppProvider } from "../src/state/react";
import { MotionProvider, useReducedMotion } from "../src/design/motion";
function Navigation() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#181817" },
        animation: reduced ? "none" : "slide_from_right",
      }}
    />
  );
}
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
        <MotionProvider>
          <Navigation />
        </MotionProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
