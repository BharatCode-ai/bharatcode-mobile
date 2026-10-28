import { useEffect, useRef, useState } from "react";
import { ScrollView, TextInput, View, Platform } from "react-native";
import { normalizePairingCode } from "../../connection/pairing-code";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const { link, delivery } = useLocalSearchParams<{
    link?: string | string[];
    delivery?: string | string[];
  }>();
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (link === undefined || Platform.OS === "web") return;
    const intent = JSON.stringify([link, delivery]);
    if (intent === opened.current) return;
    opened.current = intent;
    void store.pair(
      typeof link === "string" && typeof delivery === "string" ? link : "",
    );
  }, [link, delivery, store]);
  useEffect(() => () => store.cancelPairing(), [store]);
  const [help, setHelp] = useState(false),
    [paste, setPaste] = useState(false),
    [payload, setPayload] = useState(""),
    [code, setCode] = useState("");
  let validCode = false;
  try {
    normalizePairingCode(code);
    validCode = true;
  } catch {}
  const submitCode = () => {
    if (!validCode || state.busy || Platform.OS === "web") return;
    const submitted = code;
    setCode("");
    void store.pairCode(submitted);
  };
  useEffect(() => {
    if (
      state.device &&
      state.device !== initialDevice.current &&
      !state.confirmation
    )
      router.replace("/(tabs)/chats");
  }, [state.device, state.confirmation, router]);
  const submit = (value: string) => {
    setPaste(false);
    setPayload("");
    void store.pair(value);
  };
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
            <Txt muted>
              On Desktop, open Settings → Mobile devices and choose Generate
              code. Enter the eight-digit code below.
            </Txt>
            <TextInput
              accessibilityLabel="Eight-digit Desktop code"
              value={code}
              onChangeText={setCode}
              editable={!state.busy && Platform.OS !== "web"}
              keyboardType="number-pad"
              inputMode="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
              placeholder="1234 5678"
              placeholderTextColor={C.faint}
              returnKeyType="go"
              onSubmitEditing={submitCode}
              style={[
                s.input,
                { fontFamily: "JetBrainsMono", fontSize: 26, letterSpacing: 4 },
              ]}
            />
            <Button
              title="Connect computer"
              primary
              disabled={!validCode || state.busy || Platform.OS === "web"}
              onPress={submitCode}
            />
            {state.busy && (
              <Button
                title="Cancel pairing"
                onPress={() => store.cancelPairing()}
              />
            )}
            <Button
              title="Use an older pairing link"
              compact
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
          Generate code.
        </Txt>
        <Txt muted>
          Enter its eight-digit code, then approve the matching confirmation on
          your computer. Keep Desktop running and online. Connections use the
          existing hosted OpenTunnel service.
        </Txt>
      </Sheet>
      <Sheet
        visible={paste}
        title="Use an older pairing link"
        onClose={() => {
          setPaste(false);
          setPayload("");
        }}
      >
        <Txt muted>
          Paste an older Desktop pairing link or complete pairing payload.
          Desktop approval is still required.
        </Txt>
        <TextInput
          accessibilityLabel="Pairing payload"
          value={payload}
          onChangeText={setPayload}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { minHeight: 120 }]}
          placeholder="Paste Desktop pairing link"
          placeholderTextColor={C.faint}
        />
        <Button
          title="Connect with older link"
          primary
          disabled={!payload.trim()}
          onPress={() => submit(payload)}
        />
      </Sheet>
    </Frame>
  );
}
