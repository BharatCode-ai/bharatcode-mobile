import { useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Empty,
  Frame,
  Header,
  ListRow,
  Icon,
  IconButton,
  Notices,
  IssueCard,
  Sheet,
  Txt,
} from "../../design/components";
import { describeIssue } from "../../design/issues";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function ChatsScreen() {
  const { store, state } = useApp();
  const router = useRouter();
  const [projects, setProjects] = useState(false),
    [computers, setComputers] = useState(false);
  const visible = state.sessions.filter(
    (v) =>
      (state.project === "All projects" || v.project === state.project) &&
      (!state.preview ||
        v.title.toLowerCase().includes(state.search.toLowerCase())),
  );
  const open = (id: string) =>
    router.push({ pathname: "/conversation/[id]", params: { id } });
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await store.retryChats();
    } finally {
      setRetrying(false);
    }
  };
  const filtered = !!state.search || state.project !== "All projects";
  const needsPairing =
    !!state.error &&
    describeIssue(state.error, "", state.device?.name, state.errorStatus).pair;
  const issue = state.error && (
    <IssueCard
      message={state.error}
      fallback="Couldn’t load chats"
      desktop={state.device?.name}
      status={state.errorStatus}
      actionLabel={needsPairing ? "Pair again" : "Try again"}
      pending={state.loadingSessions || retrying}
      onAction={() => (needsPairing ? router.push("/pair") : void retry())}
    />
  );
  return (
    <Frame>
      <Header
        large
        title="Chats"
        subtitle={`${state.device?.name ?? "Computer"} · ${state.online ? "Connected" : "Offline"}`}
        left={
          <IconButton
            label="Choose computer"
            icon="desktop-outline"
            onPress={() => setComputers(true)}
          />
        }
        right={
          <IconButton
            label="New chat"
            icon="add"
            disabled={!state.online}
            onPress={() =>
              void store.newChat().then(() => {
                const id = store.getSnapshot().selected?.id;
                if (id) open(id);
              })
            }
          />
        }
      />
      <Notices hideError />
      <View style={{ padding: 20, gap: 12 }}>
        <View style={[s.row, s.input, { paddingVertical: 0 }]}>
          <Icon name="search" color={C.muted} />
          <TextInput
            accessibilityLabel="Search chats"
            placeholder="Search chats"
            placeholderTextColor={C.faint}
            value={state.search}
            onChangeText={(text) => store.setSearch(text)}
            style={[s.body, { flex: 1, minHeight: 48 }]}
          />
          {!!state.search && (
            <IconButton
              label="Clear search"
              icon="close"
              onPress={() => store.setSearch("")}
            />
          )}
        </View>
        <View style={s.row}>
          <Button
            title={state.project}
            icon="folder-outline"
            onPress={() => setProjects(true)}
          />
          {state.loadingSessions && <Txt muted>Loading…</Txt>}
        </View>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(v) => v.id}
        refreshing={state.loadingSessions}
        onRefresh={() => void retry()}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <ListRow
            title={item.title}
            detail={item.project}
            onPress={() => open(item.id)}
            icon={
              item.status === "attention"
                ? "hand-left-outline"
                : item.status === "running"
                  ? "pulse-outline"
                  : "chatbubble-outline"
            }
            accent={
              item.status === "attention"
                ? C.orange
                : item.status === "running"
                  ? C.green
                  : C.muted
            }
            trailing={
              item.status === "attention"
                ? "Needs input"
                : item.status === "running"
                  ? "Running"
                  : new Date(item.updated).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
            }
          />
        )}
        ListHeaderComponent={
          issue ? <View style={{ marginBottom: 12 }}>{issue}</View> : undefined
        }
        ListEmptyComponent={
          issue ? undefined : (
            <Empty
              title={
                state.loadingSessions || state.busy
                  ? "Loading chats"
                  : filtered
                    ? "No results"
                    : "No chats yet"
              }
              detail={
                state.loadingSessions || state.busy
                  ? "Getting your conversations from Desktop."
                  : filtered
                    ? "Try another search or project."
                    : "Start a chat to begin working with Desktop."
              }
              action={
                filtered ? (
                  <Button
                    title="Clear filters"
                    onPress={() => {
                      store.setSearch("");
                      store.setProject("All projects");
                    }}
                  />
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={
          state.sessionCursor ? (
            <Button
              title="Load more chats"
              disabled={state.loadingSessions}
              onPress={() => void store.refreshSessions(true)}
            />
          ) : (
            <View style={{ height: 24 }} />
          )
        }
      />
      <Sheet
        title="Projects"
        visible={projects}
        onClose={() => setProjects(false)}
      >
        {["All projects", ...new Set(state.sessions.map((v) => v.project))].map(
          (project) => (
            <Button
              key={project}
              title={project}
              onPress={() => {
                store.setProject(project);
                setProjects(false);
              }}
            />
          ),
        )}
      </Sheet>
      <Sheet
        title="Computers"
        visible={computers}
        onClose={() => setComputers(false)}
      >
        {state.devices.map((device) => (
          <Button
            key={device.id}
            title={device.name}
            icon="desktop-outline"
            onPress={() => {
              setComputers(false);
              void store.connectDevice(device);
            }}
          />
        ))}
        <Button
          title="Add computer"
          icon="add"
          onPress={() => {
            setComputers(false);
            router.push("/pair");
          }}
        />
      </Sheet>
    </Frame>
  );
}
