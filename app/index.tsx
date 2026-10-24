import { Redirect } from "expo-router";
import { useApp } from "../src/state/react";
export default function Index() {
  const { state } = useApp();
  return <Redirect href={state.device ? "/(tabs)/chats" : "/pair"} />;
}
