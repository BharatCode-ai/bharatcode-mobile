import { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, TextInput, View, Platform } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useURL } from "expo-linking";
import {
  Brand,
  Button,
  Busy,
  Frame,
  Header,
  IconButton,
  Notices,
  Sheet,
  Txt,
} from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function PairingScreen() {
  const { store, state } = useApp();
  const router = useRouter();
  const initialDevice = useRef(state.device);
  const scanned = useRef(false);
  const incoming = useURL();
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (
      !incoming?.startsWith("bharatcode://pair") ||
      incoming === opened.current ||
      Platform.OS === "web"
    )
      return;
    opened.current = incoming;
    void store.pair(incoming);
  }, [incoming, store]);
  useEffect(() => () => store.cancelPairing(), [store]);
  const [scan, setScan] = useState(false),
    [help, setHelp] = useState(false),
    [paste, setPaste] = useState(false),
    [payload, setPayload] = useState(""),
    [torch, setTorch] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    if (
      state.device &&
      state.device !== initialDevice.current &&
      !state.confirmation
    )
      router.replace("/(tabs)/chats");
  }, [state.device, state.confirmation, router]);
  const startScan = async () => {
    if (Platform.OS === "web") return;
    scanned.current = false;
    setScan(true);
    if (!permission?.granted && permission?.canAskAgain !== false)
      await requestPermission();
  };
  const submit = (value: string) => {
    setScan(false);
    setPaste(false);
    setPayload("");
    void store.pair(value);
  };
  if (scan)
    return (
      <Frame>
        <Header
          title="Scan Desktop QR"
          left={
            <IconButton
              label="Close scanner"
              icon="close"
              onPress={() => setScan(false)}
            />
          }
        />
        {permission?.granted ? (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                if (scanned.current) return;
                scanned.current = true;
                submit(data);
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: 40,
                left: 20,
                right: 20,
                gap: 12,
              }}
            >
              <View style={s.panel}>
                <Txt>Scan the QR in Desktop → Settings → Mobile devices.</Txt>
              </View>
              <Button
                title={torch ? "Flashlight off" : "Flashlight on"}
                onPress={() => setTorch((v) => !v)}
                icon="flashlight-outline"
              />
            </View>
          </View>
        ) : (
          <View style={[s.content, s.grow]}>
            <Txt>Camera access is needed to scan your Desktop pairing QR.</Txt>
            <Button
              title={
                permission?.canAskAgain === false
                  ? "Open settings"
                  : "Allow camera"
              }
              onPress={() => {
                if (permission?.canAskAgain === false)
                  void Linking.openSettings();
                else void requestPermission();
              }}
            />
            <Button
              title="Paste pairing code instead"
              onPress={() => {
                setScan(false);
                setPaste(true);
              }}
            />
          </View>
        )}
      </Frame>
    );
  return (
    <Frame>
      <Header
        title="BharatCode"
        left={<Brand />}
        right={
          state.device ? (
            <IconButton
              label="Back to chats"
              icon="close"
              onPress={() => router.back()}
            />
          ) : undefined
        }
      />
      <Notices />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { flexGrow: 1, justifyContent: "center", gap: 24, paddingBottom: 60 },
        ]}
      >
        <Brand size={64} />
        <Txt style={{ fontSize: 34, lineHeight: 42, fontWeight: "600" }}>
          Continue from{`\n`}your computer.
        </Txt>
        <Txt muted style={{ fontSize: 16, lineHeight: 25 }}>
          Your chats, tools, and projects—right where you left them. Your
          computer keeps running the work.
        </Txt>
        {state.confirmation ? (
          <View style={[s.panel, { gap: 16 }]}>
            <Txt>Waiting for approval on your computer</Txt>
            <Txt
              selectable
              style={{
                fontFamily: "JetBrainsMono",
                fontSize: 32,
                letterSpacing: 6,
                color: C.orange,
              }}
            >
              {state.confirmation}
            </Txt>
            <Txt muted>
              Check that this code matches Desktop before approving.
            </Txt>
            <Button
              title="Cancel pairing"
              onPress={() => store.cancelPairing()}
            />
          </View>
        ) : (
          <>
            <Button
              title="Scan Desktop QR"
              primary
              icon="qr-code-outline"
              disabled={state.busy || Platform.OS === "web"}
              onPress={() => void startScan()}
            />
            <Button
              title="Paste pairing code"
              disabled={state.busy || Platform.OS === "web"}
              onPress={() => setPaste(true)}
            />
            {state.busy && <Busy />}
            <Button
              title="How to connect"
              compact
              onPress={() => setHelp(true)}
            />
            <Button
              title="Explore a sample workspace"
              compact
              onPress={() =>
                void store
                  .enterPreview()
                  .then(() => router.replace("/(tabs)/chats"))
              }
            />
          </>
        )}
      </ScrollView>
      <Sheet
        visible={help}
        title="Connect your computer"
        onClose={() => setHelp(false)}
      >
        <Txt>
          Open BharatCode Desktop, go to Settings → Mobile devices, and choose
          Connect phone.
        </Txt>
        <Txt muted>
          Scan its QR, then approve the matching code on your computer. Keep
          Desktop running and online. Connections use the existing hosted
          OpenTunnel service.
        </Txt>
      </Sheet>
      <Sheet
        visible={paste}
        title="Paste pairing code"
        onClose={() => {
          setPaste(false);
          setPayload("");
        }}
      >
        <Txt muted>
          Paste the complete pairing payload from Desktop. This uses the same
          approval flow as scanning.
        </Txt>
        <TextInput
          accessibilityLabel="Pairing payload"
          value={payload}
          onChangeText={setPayload}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { minHeight: 120 }]}
          placeholder="Paste Desktop pairing code"
          placeholderTextColor={C.faint}
        />
        <Button
          title="Connect computer"
          primary
          disabled={!payload.trim()}
          onPress={() => submit(payload)}
        />
      </Sheet>
    </Frame>
  );
}
