import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCopyText } from "../../design/use-copy-text";
import { useResource } from "../../state/use-resource";
import {
  Button,
  Busy,
  IssueCard,
  Frame,
  Header,
  IconButton,
  ListRow,
  Icon,
  Txt,
} from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function FilesScreen() {
  const { store, state } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [path, setPath] = useState(""),
    [wrap, setWrap] = useState(false),
    [attempt, setAttempt] = useState(0);
  const { copied, copyFailed, copy, resetCopy } = useCopyText();
  const load = useCallback(async () => {
    if (store.getSnapshot().selected?.id !== id)
      await store.openConversation(id);
    return store.loadFile(path);
  }, [id, path, store]);
  const {
    data: file,
    error,
    loading,
  } = useResource(`${id}:${path}:${attempt}`, load);
  return (
    <Frame>
      <Header
        title="Project files"
        subtitle={state.selected?.project}
        left={
          <IconButton
            label="Back to conversation"
            icon="chevron-back"
            onPress={() => router.back()}
          />
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.row, { paddingVertical: 8 }]}>
          <Icon name="folder-open-outline" color={C.orange} size={20} />
          <Txt selectable style={[s.mono, { flex: 1 }]}>
            {path || "Project root"}
          </Txt>
        </View>
        {!!path && (
          <Button
            title="Parent folder"
            icon="arrow-up"
            onPress={() => setPath(path.split("/").slice(0, -1).join("/"))}
          />
        )}
        {loading ? (
          <Busy />
        ) : error ? (
          <IssueCard
            message={error}
            fallback="Couldn’t load files"
            actionLabel="Retry files"
            onAction={() => setAttempt((v) => v + 1)}
          />
        ) : file?.type === "directory" ? (
          <>
            <View>
              {file.entries?.map((e) => (
                <ListRow
                  accent={e.directory ? C.orange : C.muted}
                  key={e.name}
                  title={e.name + (e.symlink ? " ↗" : "")}
                  icon={
                    e.directory ? "folder-outline" : "document-text-outline"
                  }
                  onPress={() => {
                    resetCopy();
                    setPath(path ? `${path}/${e.name}` : e.name);
                  }}
                />
              ))}
            </View>
            {!file.entries?.length && <Txt muted>This folder is empty.</Txt>}
            {file.truncated && (
              <Txt muted>Showing the first 2,000 entries.</Txt>
            )}
          </>
        ) : file?.binary ? (
          <Txt muted>Binary file — text preview unavailable.</Txt>
        ) : file?.tooLarge ? (
          <Txt muted>This file is too large to preview on your phone.</Txt>
        ) : (
          <>
            <View style={s.row}>
              <Button
                title={wrap ? "Disable wrap" : "Wrap lines"}
                onPress={() => setWrap((v) => !v)}
              />
              <Button
                title={copied ? "Copied" : "Copy file"}
                onPress={() => void copy(file?.text ?? "")}
              />
            </View>
            {copyFailed && (
              <IssueCard
                message="Clipboard unavailable"
                fallback="Couldn’t copy text"
              />
            )}
            <View style={[s.panel, { backgroundColor: C.surface }]}>
              {wrap ? (
                <Txt selectable style={s.mono}>
                  {file?.text}
                </Txt>
              ) : (
                <ScrollView horizontal>
                  <Txt selectable style={s.mono}>
                    {file?.text}
                  </Txt>
                </ScrollView>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Frame>
  );
}
