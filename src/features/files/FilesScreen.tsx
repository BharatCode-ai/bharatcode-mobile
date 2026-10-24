import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useResource } from "../../state/use-resource";
import {
  Button,
  Busy,
  Frame,
  Header,
  IconButton,
  Txt,
} from "../../design/components";
import { styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function FilesScreen() {
  const { store, state } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [path, setPath] = useState(""),
    [wrap, setWrap] = useState(false),
    [attempt, setAttempt] = useState(0),
    [copied, setCopied] = useState(false);
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
        <Txt selectable style={s.mono}>
          {path || "Project root"}
        </Txt>
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
          <>
            <Txt>{error}</Txt>
            <Button
              title="Retry files"
              onPress={() => setAttempt((v) => v + 1)}
            />
          </>
        ) : file?.type === "directory" ? (
          <>
            {file.entries?.map((e) => (
              <Button
                key={e.name}
                title={e.name + (e.symlink ? " ↗" : "")}
                icon={e.directory ? "folder-outline" : "document-text-outline"}
                onPress={() => setPath(path ? `${path}/${e.name}` : e.name)}
              />
            ))}
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
                onPress={() =>
                  void Clipboard.setStringAsync(file?.text ?? "").then(() =>
                    setCopied(true),
                  )
                }
              />
            </View>
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
          </>
        )}
      </ScrollView>
    </Frame>
  );
}
