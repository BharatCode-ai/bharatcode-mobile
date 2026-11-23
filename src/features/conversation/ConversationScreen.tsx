import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { AgentRequest, Configuration } from "../../domain/types";
import {
  IssueCard,
  Button,
  Busy,
  Frame,
  Header,
  Icon,
  IconButton,
  Notices,
  Sheet,
  Txt,
} from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
import { Reveal, useReducedMotion } from "../../design/motion";
import { Message } from "./Message";
import { QuestionSheet } from "./QuestionSheet";
export default function ConversationScreen() {
  const { id, mode, request } = useLocalSearchParams<{
    id: string;
    mode?: string;
    request?: string;
  }>();
  const control = mode === "control";
  const { width } = useWindowDimensions();
  const beside = control && width >= 840;
  const { store, state } = useApp();
  const router = useRouter();
  const reduced = useReducedMotion();
  const running = state.sessions.some(
    (session) => session.id === id && session.status === "running",
  );
  const inset = useSafeAreaInsets();
  const list = useRef<FlatList>(null);
  const near = useRef(true);
  const [jump, setJump] = useState(false),
    [info, setInfo] = useState(false),
    [clipboardError, setClipboardError] = useState(false),
    [context, setContext] = useState(false),
    [question, setQuestion] = useState<AgentRequest>(),
    [configuration, setConfiguration] = useState<"model" | "agent">(),
    [items, setItems] = useState<Configuration[]>([]),
    [configError, setConfigError] = useState<string>(),
    [loadingConfig, setLoadingConfig] = useState(false);
  const relevant = state.requests
    .filter((r) => r.sessionID === id)
    .sort((a, b) => Number(b.id === request) - Number(a.id === request));
  useEffect(() => {
    if (id && store.getSnapshot().selected?.id !== id)
      void store.openConversation(id);
  }, [id, store, state.online, state.device]);
  useEffect(() => {
    return () => {
      if (id) store.closeConversation(id);
    };
  }, [id, store]);
  useEffect(() => {
    if (!state.device) router.replace("/pair");
  }, [state.device, router]);
  const tail = state.messages.at(-1);
  useEffect(() => {
    if (control && !beside) return;
    if (near.current) {
      const handle = setTimeout(
        () => list.current?.scrollToEnd({ animated: false }),
        50,
      );
      return () => clearTimeout(handle);
    }
    setJump(true);
  }, [tail?.text, state.messages.length, control, beside]);
  const choose = async (kind: "agent" | "model") => {
    setConfiguration(kind);
    setLoadingConfig(true);
    setConfigError(undefined);
    setItems([]);
    try {
      setItems(await store.configuration(kind));
    } catch (e) {
      setConfigError(String(e));
    } finally {
      setLoadingConfig(false);
    }
  };
  const back = () => {
    store.backToChats();
    router.replace(control ? "/(tabs)/activity" : "/(tabs)/chats");
  };
  const draftDisabled =
    !state.online ||
    !state.conversationReady ||
    state.busy ||
    !state.selected ||
    state.sending ||
    !state.draft.trim();
  const actions = (
    <View style={{ gap: 12 }}>
      {control && (
        <Txt style={{ fontSize: 18, fontWeight: "600" }}>Session activity</Txt>
      )}
      {relevant.map((r) => (
        <View
          key={r.id}
          style={[
            s.panel,
            { gap: 10, borderLeftWidth: 3, borderLeftColor: C.orange },
          ]}
        >
          <Txt muted style={{ color: C.orange }}>
            {r.question ? "Question" : "Permission request"}
          </Txt>
          <Txt style={{ fontWeight: "600" }}>{r.title}</Txt>
          {!!r.command && (
            <Txt selectable style={s.mono}>
              {r.command}
            </Txt>
          )}
          {!!r.directory && <Txt muted>{r.directory}</Txt>}
          {r.question ? (
            <Button
              title="Answer question"
              primary
              onPress={() => setQuestion(r)}
            />
          ) : (
            <View style={s.row}>
              <Button
                title="Allow once"
                primary
                disabled={!state.online || state.deciding.includes(r.id)}
                onPress={() => void store.decide(r, true)}
              />
              <Button
                title="Deny"
                disabled={!state.online || state.deciding.includes(r.id)}
                onPress={() => void store.decide(r, false)}
              />
            </View>
          )}
        </View>
      ))}
      <Button
        title="View working changes"
        icon="git-compare-outline"
        onPress={() =>
          router.push({
            pathname: "/conversation/[id]/changes",
            params: { id },
          })
        }
      />
    </View>
  );
  return (
    <Frame wide={beside}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Header
          title={
            control
              ? "Desktop Control"
              : (state.selected?.title ?? "Conversation")
          }
          subtitle={`${control ? (state.selected?.title ?? "Conversation") + " · " : ""}${state.online ? "●" : "○"} ${state.device?.name ?? "Computer"}${state.online ? "" : " · Offline"}`}
          left={
            <IconButton
              label={control ? "Back to activity" : "Back to chats"}
              icon="chevron-back"
              onPress={back}
            />
          }
          right={
            <IconButton
              label="Conversation information"
              icon="ellipsis-horizontal"
              onPress={() => setInfo(true)}
            />
          }
        />
        <Notices hideError={!!question} />
        <View
          style={[
            s.row,
            {
              marginHorizontal: 16,
              marginTop: 8,
              paddingHorizontal: 12,
              backgroundColor: C.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C.border,
            },
          ]}
        >
          <Icon name="folder-outline" size={17} color={C.muted} />
          <Txt muted style={{ flex: 1 }}>
            {state.selected?.project ?? "Project"}
          </Txt>
          <IconButton
            label={control ? "Open chat view" : "Open Desktop Control"}
            icon={control ? "chatbubble-outline" : "desktop-outline"}
            onPress={() => {
              router.setParams({ mode: control ? "chat" : "control" });
              if (!control)
                list.current?.scrollToOffset({ offset: 0, animated: false });
            }}
          />
          <Button
            title="Files"
            compact
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]/files",
                params: { id },
              })
            }
          />
        </View>
        {state.busy && <Busy />}
        <View style={{ flex: 1, flexDirection: "row" }}>
          <FlatList
            style={{ flex: 1 }}
            ref={list}
            data={state.messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 16,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } =
                e.nativeEvent;
              near.current =
                contentSize.height -
                  contentOffset.y -
                  layoutMeasurement.height <
                90;
              if (near.current) setJump(false);
            }}
            scrollEventThrottle={100}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            renderItem={({ item }) => <Message message={item} />}
            ListHeaderComponent={
              <>
                {control && !beside && <Reveal>{actions}</Reveal>}
                {state.messageCursor ? (
                  <Button
                    title="Load earlier messages"
                    onPress={() => void store.loadOlderMessages()}
                  />
                ) : null}
              </>
            }
            ListEmptyComponent={
              !state.busy && !state.error && state.online ? (
                <View style={{ paddingVertical: 32 }}>
                  <Txt muted>
                    Continue this conversation. Your computer runs the work.
                  </Txt>
                </View>
              ) : undefined
            }
            ListFooterComponent={!control ? actions : undefined}
          />
          {beside && (
            <ScrollView
              style={{
                width: 320,
                flexGrow: 0,
                borderLeftWidth: 1,
                borderColor: C.border,
              }}
              contentContainerStyle={{ padding: 16 }}
            >
              <Reveal>{actions}</Reveal>
            </ScrollView>
          )}
        </View>
        {jump && (!control || beside) && (
          <Button
            title="Jump to latest"
            icon="arrow-down"
            onPress={() => {
              near.current = true;
              setJump(false);
              list.current?.scrollToEnd({ animated: !reduced });
            }}
          />
        )}
        {state.pending && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <Button
              title="Restore unconfirmed message"
              onPress={() => store.restoreUnconfirmedDraft()}
            />
          </View>
        )}
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: Math.max(10, inset.bottom),
            borderTopWidth: 1,
            borderTopColor: C.border,
            backgroundColor: C.canvas,
            gap: 8,
          }}
        >
          <View style={[s.row, { gap: 6, alignItems: "flex-end" }]}>
            <View
              style={[
                s.row,
                {
                  flex: 1,
                  gap: 0,
                  backgroundColor: C.surface,
                  borderColor: C.border,
                  borderWidth: 1,
                  borderRadius: 20,
                  alignItems: "flex-end",
                },
              ]}
            >
              <IconButton
                label="Add context"
                icon="attach"
                onPress={() => {
                  setClipboardError(false);
                  setContext(true);
                }}
              />
              <TextInput
                accessibilityLabel="Message BharatCode"
                editable={state.conversationReady && !!state.selected}
                placeholder="Message BharatCode…"
                placeholderTextColor={C.faint}
                value={state.draft}
                onChangeText={(text) => store.setDraft(text)}
                multiline
                style={[
                  s.input,
                  {
                    flex: 1,
                    maxHeight: 160,
                    minHeight: 48,
                    borderWidth: 0,
                    backgroundColor: "transparent",
                    paddingLeft: 0,
                  },
                ]}
              />
            </View>
            {running && !state.draft.trim() ? (
              <View style={{ backgroundColor: C.orange, borderRadius: 24 }}>
                <IconButton
                  label="Stop task"
                  icon="stop"
                  color={C.canvas}
                  disabled={!state.online}
                  onPress={() => void store.stop()}
                />
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: draftDisabled ? C.raised : C.orange,
                  borderRadius: 24,
                }}
              >
                <IconButton
                  label="Send message"
                  icon="arrow-up"
                  color={draftDisabled ? C.muted : C.canvas}
                  disabled={draftDisabled}
                  onPress={() => void store.send()}
                />
              </View>
            )}
          </View>
          <View
            style={[
              s.row,
              {
                gap: 0,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 24,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Button
                title={state.agent + " ⌄"}
                icon="hardware-chip-outline"
                compact
                onPress={() => void choose("agent")}
              />
            </View>
            <View style={{ height: 24, width: 1, backgroundColor: C.border }} />
            <View style={{ flex: 1 }}>
              <Button
                title={state.model + " ⌄"}
                compact
                onPress={() => void choose("model")}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Sheet
        visible={info}
        title={state.selected?.title ?? "Conversation"}
        onClose={() => setInfo(false)}
      >
        <Txt selectable style={s.mono}>
          {id}
        </Txt>
        <Txt>Project: {state.selected?.project}</Txt>
        <Txt muted>
          This is the same conversation on your computer. Your phone does not
          run a separate agent.
        </Txt>
        <Button
          title="Stop task"
          icon="stop-outline"
          disabled={!state.online || !state.selected}
          onPress={() => {
            setInfo(false);
            void store.stop();
          }}
        />
        <Button
          title="Retry conversation connection"
          onPress={() => {
            setInfo(false);
            void store.openConversation(id);
          }}
        />
      </Sheet>
      <Sheet
        visible={context}
        title="Add context"
        onClose={() => setContext(false)}
      >
        <Txt muted>
          Paste a code snippet or file reference into your message. Files remain
          on your computer.
        </Txt>
        {clipboardError && (
          <IssueCard
            message="Clipboard unavailable"
            fallback="Couldn’t paste text"
          />
        )}
        <Button
          title="Paste from clipboard"
          icon="clipboard-outline"
          onPress={() =>
            void Clipboard.getStringAsync()
              .then((text) => {
                if (text)
                  store.setDraft(
                    store.getSnapshot().draft +
                      (store.getSnapshot().draft ? "\n" : "") +
                      text,
                  );
                setContext(false);
              })
              .catch(() => setClipboardError(true))
          }
        />
      </Sheet>
      <Sheet
        visible={!!configuration}
        title={`Choose ${configuration ?? "configuration"}`}
        onClose={() => setConfiguration(undefined)}
      >
        {loadingConfig ? (
          <Busy />
        ) : configError ? (
          <IssueCard
            message={configError}
            fallback="Couldn’t update chat settings"
            actionLabel="Reload options"
            onAction={() => configuration && void choose(configuration)}
          />
        ) : items.length ? (
          items.map((item) => (
            <Button
              key={`${item.providerID ?? ""}:${item.id}`}
              title={item.name ?? item.id}
              onPress={() => {
                if (configuration)
                  void store
                    .switchConfiguration(configuration, item)
                    .then(() => setConfiguration(undefined))
                    .catch((e) => setConfigError(String(e)));
              }}
            />
          ))
        ) : (
          <Txt muted>No configured options available on Desktop.</Txt>
        )}
        <Txt muted>
          Configured on your computer. Provider credentials stay there.
        </Txt>
      </Sheet>
      {question && (
        <QuestionSheet
          key={question.id}
          request={question}
          onClose={() => setQuestion(undefined)}
        />
      )}
    </Frame>
  );
}
