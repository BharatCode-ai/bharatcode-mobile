import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { fetch } from "expo/fetch";
import * as Crypto from "expo-crypto";
import { AppStore } from "./app-store";
import { ApiClient } from "../connection/api-client";
import {
  ConversationStore,
  MemoryDatabase,
} from "../storage/conversation-store";
const Context = createContext<AppStore | undefined>(undefined);
export function AppProvider({ children }: PropsWithChildren) {
  const [store, setStore] = useState<AppStore>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let instance: AppStore | undefined;
    const init = async () => {
      const preview =
        Platform.OS === "web" || process.env.EXPO_PUBLIC_BC_PREVIEW === "1";
      if (preview) {
        instance = new AppStore({
          persistence: new ConversationStore(new MemoryDatabase()),
          credentials: {
            get: async () => undefined,
            set: async () => {},
            remove: async () => {},
          },
          id: () => `msg_${Crypto.randomUUID().replaceAll("-", "")}`,
        });
        await instance.enterPreview();
      } else {
        const native = await import("../storage/native");
        const db = await native.openDatabase();
        instance = new AppStore({
          persistence: new ConversationStore(db),
          credentials: native.credentials,
          apiFactory: (origin, token) =>
            new ApiClient(origin, token, fetch as typeof globalThis.fetch),
          id: () => `msg_${Crypto.randomUUID().replaceAll("-", "")}`,
          deviceName: Platform.OS === "ios" ? "iPhone" : "Android phone",
        });
        await instance.restore();
      }
      if (alive) setStore(instance);
      else instance.dispose();
    };
    void init().catch((e) => {
      if (alive)
        setError(
          e instanceof Error ? e.message : "Storage could not be opened",
        );
    });
    return () => {
      alive = false;
      instance?.dispose();
    };
  }, [attempt]);
  useEffect(() => {
    if (!store) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void store.resume();
      else if (state === "background") store.suspend();
    });
    return () => sub.remove();
  }, [store]);
  if (!store)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#181817",
          padding: 32,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#F2F0E9", fontFamily: "Inter", fontSize: 16 }}>
          {error ?? "Opening BharatCode…"}
        </Text>
        {error && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry opening app"
            style={{ minHeight: 48, paddingVertical: 16 }}
            onPress={() => {
              setError(undefined);
              setAttempt((v) => v + 1);
            }}
          >
            <Text
              style={{ color: "#FF6933", fontFamily: "Inter", fontSize: 16 }}
            >
              Retry opening app
            </Text>
          </Pressable>
        )}
      </View>
    );
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function StoreProvider({
  store,
  children,
}: PropsWithChildren<{ store: AppStore }>) {
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useApp() {
  const store = useContext(Context);
  if (!store) throw new Error("Application store unavailable");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return { store, state };
}
