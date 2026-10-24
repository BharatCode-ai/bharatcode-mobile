import { Redirect, Tabs } from "expo-router";
import { Icon } from "../../src/design/components";
import { C } from "../../src/design/tokens";
import { useApp } from "../../src/state/react";
export default function Layout() {
  const { state } = useApp();
  if (!state.device) return <Redirect href="/pair" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.canvas,
          borderTopColor: C.border,
          minHeight: 72,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter",
          fontSize: 11,
          paddingBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => (
            <Icon
              name="chatbubbles-outline"
              color={typeof color === "string" ? color : C.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarBadge: state.requests.length || undefined,
          tabBarIcon: ({ color }) => (
            <Icon
              name="pulse-outline"
              color={typeof color === "string" ? color : C.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: "Devices",
          tabBarIcon: ({ color }) => (
            <Icon
              name="desktop-outline"
              color={typeof color === "string" ? color : C.muted}
            />
          ),
        }}
      />
    </Tabs>
  );
}
