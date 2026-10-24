import { memo, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import Markdown from "react-native-markdown-display";
import * as Clipboard from "expo-clipboard";
import { ChatMessage, ToolActivity } from "../../domain/types";
import { Brand, Button, Sheet, Txt } from "../../design/components";
import { C, styles as s } from "../../design/tokens";
export function ToolPanel({ tool }: { tool: ToolActivity }) {
  const [expanded, setExpanded] = useState(false),
    [full, setFull] = useState(false);
  const content = `Input\n${tool.input}\n\nOutput\n${tool.output}`;
  return (
    <View style={[s.panel, { gap: 8, padding: 10 }]}>
      <Button
        title={`${tool.name} · ${tool.status}`}
        icon={expanded ? "chevron-up" : "chevron-down"}
        compact
        onPress={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <>
          <Txt selectable style={s.mono}>
            {content.slice(0, 4000)}
          </Txt>
          {content.length > 4000 && (
            <Button
              title="View full tool output"
              onPress={() => setFull(true)}
            />
          )}
        </>
      )}
      <Sheet title={tool.name} visible={full} onClose={() => setFull(false)}>
        <ScrollView horizontal>
          <Txt selectable style={s.mono}>
            {content}
          </Txt>
        </ScrollView>
        <Button
          title="Copy tool output"
          onPress={() => void Clipboard.setStringAsync(content)}
        />
      </Sheet>
    </View>
  );
}
function Code({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false),
    [full, setFull] = useState(false);
  const copy = () =>
    void Clipboard.setStringAsync(content).then(() => setCopied(true));
  return (
    <View
      style={[s.panel, { padding: 0, marginVertical: 10, overflow: "hidden" }]}
    >
      <View
        style={[
          s.row,
          {
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          },
        ]}
      >
        <Txt muted style={{ flex: 1, fontFamily: "JetBrainsMono" }}>
          {language || "Code"}
        </Txt>
        <Button title={copied ? "Copied" : "Copy"} compact onPress={copy} />
        <Button title="Expand" compact onPress={() => setFull(true)} />
      </View>
      <ScrollView horizontal contentContainerStyle={{ padding: 14 }}>
        <Txt selectable style={s.mono}>
          {content.length > 16000
            ? content.slice(0, 16000) + "\n… Expand to read full code"
            : content}
        </Txt>
      </ScrollView>
      <Sheet
        visible={full}
        title={language || "Code"}
        onClose={() => setFull(false)}
      >
        <ScrollView horizontal>
          <Txt selectable style={s.mono}>
            {content}
          </Txt>
        </ScrollView>
        <Button title={copied ? "Copied" : "Copy code"} onPress={copy} />
      </Sheet>
    </View>
  );
}
const markdownStyles = {
  body: { fontFamily: "Inter", fontSize: 16, lineHeight: 25, color: C.text },
  heading1: { fontSize: 25, lineHeight: 32, color: C.text },
  heading2: { fontSize: 21, lineHeight: 29, color: C.text },
  heading3: { fontSize: 18, lineHeight: 26, color: C.text },
  paragraph: { marginTop: 0, marginBottom: 16 },
  code_inline: {
    fontFamily: "JetBrainsMono",
    backgroundColor: C.surface,
    color: C.text,
  },
  link: { color: C.orange },
  table: { borderColor: C.border },
  th: { borderColor: C.border },
  td: { borderColor: C.border },
  blockquote: { backgroundColor: C.surface, borderColor: C.orange },
  hr: { backgroundColor: C.border },
  bullet_list_icon: { color: C.muted },
};
export const Message = memo(function Message({
  message,
}: {
  message: ChatMessage;
}) {
  const [copied, setCopied] = useState(false);
  if (message.role === "user")
    return (
      <View
        style={{
          alignSelf: "flex-end",
          maxWidth: "92%",
          backgroundColor: C.raised,
          borderColor: C.border,
          borderWidth: 1,
          padding: 16,
          borderRadius: 20,
          marginVertical: 12,
        }}
      >
        <Txt selectable>{message.text}</Txt>
      </View>
    );
  return (
    <View style={{ gap: 12, marginVertical: 16 }}>
      <View style={s.row}>
        <View
          style={{
            padding: 8,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 12,
          }}
        >
          <Brand size={24} />
        </View>
        <View style={{ flex: 1 }} />
        <Button
          title={copied ? "Copied" : "Copy reply"}
          compact
          onPress={() =>
            void Clipboard.setStringAsync(message.text).then(() =>
              setCopied(true),
            )
          }
        />
      </View>
      <Markdown
        style={markdownStyles}
        mergeStyle
        onLinkPress={(url) => {
          if (/^https?:\/\//i.test(url)) void Linking.openURL(url);
          return false;
        }}
        rules={{
          fence: (node) => (
            <Code
              key={node.key}
              content={node.content}
              language={
                (node as typeof node & { sourceInfo?: string }).sourceInfo
              }
            />
          ),
          code_block: (node) => <Code key={node.key} content={node.content} />,
          textgroup: (node, children) => (
            <Txt key={node.key} selectable>
              {children}
            </Txt>
          ),
        }}
      >
        {message.text}
      </Markdown>
      {message.tools.map((tool) => (
        <ToolPanel key={tool.id} tool={tool} />
      ))}
    </View>
  );
});
