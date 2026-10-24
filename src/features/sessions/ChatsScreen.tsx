import { useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Empty,
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
  return (
    <Frame>
      <Header
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
      <Notices />
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
        onRefresh={() => void store.refreshSessions()}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <View
            style={{
              borderBottomColor: C.border,
              borderBottomWidth: 1,
              paddingVertical: 12,
            }}
          >
            <Button
              title={item.title}
              align="left"
              compact
              onPress={() => open(item.id)}
            />
            <View style={[s.row, { paddingHorizontal: 10 }]}>
              <Txt muted style={{ flex: 1 }}>
                {item.project}
              </Txt>
              <Txt
                muted
                style={{
                  color:
                    item.status === "attention"
                      ? C.orange
                      : item.status === "running"
                        ? C.green
                        : C.muted,
                }}
              >
                {item.status === "attention"
                  ? "Needs your attention"
                  : item.status === "running"
                    ? "Running"
                    : new Date(item.updated).toLocaleDateString()}
              </Txt>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Empty
            title={
              state.loadingSessions
                ? "Loading chats"
                : state.error
                  ? "Couldn’t load chats"
                  : state.search || state.project !== "All projects"
                    ? "No results"
                    : "No chats yet"
            }
            detail={
              state.loadingSessions
                ? "Getting your conversations from Desktop."
                : "Choose a project, start a chat, or pull to refresh."
            }
            action={
              <Button
                title={state.error ? "Retry" : "Clear filters"}
                onPress={() => {
                  if (state.error) void store.refreshSessions();
                  else {
                    store.setSearch("");
                    store.setProject("All projects");
                  }
                }}
              />
            }
          />
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
