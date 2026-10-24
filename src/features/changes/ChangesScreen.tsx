import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useResource } from "../../state/use-resource";
import {
  Button,
  Busy,
  Empty,
  Frame,
  Header,
  IconButton,
  Sheet,
  Txt,
} from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function ChangesScreen() {
  const { store } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [index, setIndex] = useState(0),
    [wrap, setWrap] = useState(false),
    [picker, setPicker] = useState(false),
    [attempt, setAttempt] = useState(0),
    [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    if (store.getSnapshot().selected?.id !== id)
      await store.openConversation(id);
    return store.loadChanges();
  }, [id, store]);
  const { data, error, loading } = useResource(`${id}:${attempt}`, load);
  const changes = data ?? [];
  const change = changes[index];
  const lines = (
    <View style={{ minWidth: wrap ? undefined : 500 }}>
      {change?.patch?.split("\n").map((line, i) => (
        <View
          key={i}
          style={{
            backgroundColor: line.startsWith("+")
              ? "#62D7850C"
              : line.startsWith("-")
                ? "#FF8B810C"
                : "transparent",
            flexDirection: "row",
            gap: 12,
            paddingHorizontal: 12,
          }}
        >
          <Txt style={[s.mono, { color: C.faint, minWidth: 32 }]}>{i + 1}</Txt>
          <Txt
            selectable
            style={[
              s.mono,
              {
                color: line.startsWith("+")
                  ? C.green
                  : line.startsWith("-")
                    ? C.red
                    : line.startsWith("@@")
                      ? C.orange
                      : C.text,
                ...(wrap ? { flex: 1 } : {}),
              },
            ]}
          >
            {line || " "}
          </Txt>
        </View>
      ))}
    </View>
  );
  return (
    <Frame>
      <Header
        title="Working changes"
        left={
          <IconButton
            label="Back to conversation"
            icon="chevron-back"
            onPress={() => router.back()}
          />
        }
      />
      {loading ? (
        <Busy />
      ) : error ? (
        <Empty
          title="Changes unavailable"
          detail={error}
          action={
            <Button
              title="Retry changes"
              onPress={() => setAttempt((v) => v + 1)}
            />
          }
        />
      ) : !changes.length ? (
        <Empty
          title="Working tree is clear"
          detail="There are no uncommitted changes in this project."
        />
      ) : (
        <>
          <View style={s.content}>
            <Button
              title={`${change?.file} · ${index + 1}/${changes.length}`}
              icon="chevron-down"
              onPress={() => setPicker(true)}
            />
            <View style={s.row}>
              <Button
                title={wrap ? "Disable wrap" : "Wrap lines"}
                onPress={() => setWrap((v) => !v)}
              />
              <Button
                title={copied ? "Copied" : "Copy diff"}
                onPress={() =>
                  void Clipboard.setStringAsync(change?.patch ?? "").then(() =>
                    setCopied(true),
                  )
                }
              />
            </View>
            <Txt muted>
              Read-only working-tree diff. Changes remain on your computer.
            </Txt>
          </View>
          <ScrollView>
            {change?.patch ? (
              wrap ? (
                lines
              ) : (
                <ScrollView horizontal>{lines}</ScrollView>
              )
            ) : (
              <Txt muted style={{ padding: 20 }}>
                No text diff available. This may be a binary or empty file.
              </Txt>
            )}
          </ScrollView>
        </>
      )}
      <Sheet
        visible={picker}
        title="Changed files"
        onClose={() => setPicker(false)}
      >
        {changes.map((c, i) => (
          <Button
            key={c.file}
            title={c.file}
            onPress={() => {
              setIndex(i);
              setCopied(false);
              setPicker(false);
            }}
          />
        ))}
      </Sheet>
    </Frame>
  );
}
