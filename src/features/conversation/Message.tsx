import { memo, useState } from "react";
import {
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { useCopyText } from "../../design/use-copy-text";
import { ChatMessage, ToolActivity } from "../../domain/types";
import {
  IssueCard,
  Brand,
  Button,
  IconButton,
  Sheet,
  Txt,
} from "../../design/components";
import { Reveal, useReducedMotion } from "../../design/motion";
import { C, styles as s } from "../../design/tokens";
export function ToolPanel({ tool }: { tool: ToolActivity }) {
  const [expanded, setExpanded] = useState(false),
    [full, setFull] = useState(false);
  const { copy, copyFailed } = useCopyText();
  const reduced = useReducedMotion();
  const content = `Input\n${tool.input}\n\nOutput\n${tool.output}`;
  return (
    <View
      style={[
        s.panel,
        {
          gap: expanded ? 8 : 0,
          paddingHorizontal: 12,
          paddingVertical: expanded ? 8 : 0,
        },
      ]}
    >
      <Button
        title={`${tool.name} · ${tool.status}`}
        align="left"
        icon={expanded ? "chevron-up" : "chevron-down"}
        compact
        onPress={() => {
          if (!reduced && Platform.OS !== "web")
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
          setExpanded((v) => !v);
        }}
      />
      {expanded && (
        <Reveal>
          <Txt selectable style={s.mono}>
            {content.slice(0, 4000)}
          </Txt>
          {content.length > 4000 && (
            <Button
              title="View full tool output"
              onPress={() => setFull(true)}
            />
          )}
        </Reveal>
      )}
      <Sheet title={tool.name} visible={full} onClose={() => setFull(false)}>
        <ScrollView horizontal>
          <Txt selectable style={s.mono}>
            {content}
          </Txt>
        </ScrollView>
        {copyFailed && (
          <IssueCard
            message="Clipboard unavailable"
            fallback="Couldn’t copy tool output"
          />
        )}
        <Button title="Copy tool output" onPress={() => void copy(content)} />
      </Sheet>
    </View>
  );
}
function Code({ content, language }: { content: string; language?: string }) {
  const { copied, copyFailed, copy } = useCopyText();
  const [full, setFull] = useState(false);
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
        <Button
          title={copied ? "Copied" : "Copy"}
          compact
          onPress={() => void copy(content)}
        />
        <Button title="Expand" compact onPress={() => setFull(true)} />
      </View>
      {copyFailed && (
        <IssueCard
          message="Clipboard unavailable"
          fallback="Couldn’t copy code"
        />
      )}
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
        {copyFailed && (
          <IssueCard
            message="Clipboard unavailable"
            fallback="Couldn’t copy code"
          />
        )}
        <Button
          title={copied ? "Copied" : "Copy code"}
          onPress={() => void copy(content)}
        />
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
  const { copied, copyFailed, copy } = useCopyText();
  const [linkFailed, setLinkFailed] = useState(false);
  if (message.role === "user")
    return (
      <View
        style={{
          alignSelf: "flex-end",
          maxWidth: "84%",
          backgroundColor: C.surface,
          borderColor: C.border,
          borderWidth: 1,
          padding: 16,
          borderRadius: 18,
          borderTopRightRadius: 6,
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
            padding: 4,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 12,
          }}
        >
          <Brand size={24} />
        </View>
        <Txt style={{ flex: 1, fontWeight: "600" }}>BharatCode</Txt>
        <IconButton
          label={copied ? "Copied" : "Copy reply"}
          icon={copied ? "checkmark" : "copy-outline"}
          color={copied ? C.green : C.muted}
          onPress={() => void copy(message.text)}
        />
      </View>
      {copyFailed && (
        <IssueCard
          message="Clipboard unavailable"
          fallback="Couldn’t copy reply"
        />
      )}
      {linkFailed && (
        <IssueCard
          message="Open external link"
          fallback="Couldn’t open link"
          onDismiss={() => setLinkFailed(false)}
        />
      )}
      <Markdown
        style={markdownStyles}
        mergeStyle
        onLinkPress={(url) => {
          if (/^https?:\/\//i.test(url))
            void Linking.openURL(url).catch(() => setLinkFailed(true));
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
          textgroup: (node, children, parents) => (
            <Txt key={node.key} selectable>
              {parents.every((parent) =>
                ["paragraph", "body"].includes(parent.type),
              ) &&
              node.children.every((child) =>
                ["text", "softbreak", "hardbreak"].includes(child.type),
              )
                ? node.children
                    .map((child) =>
                      child.type === "text" ? child.content : "\n",
                    )
                    .join("")
                : children}
            </Txt>
          ),
        }}
      >
        {message.text}
      </Markdown>
      {message.replyIssue && (
        <IssueCard
          message={`reply/${message.replyIssue}`}
          fallback="The reply was interrupted"
        />
      )}
      {message.tools.map((tool) => (
        <ToolPanel key={tool.id} tool={tool} />
      ))}
    </View>
  );
});
