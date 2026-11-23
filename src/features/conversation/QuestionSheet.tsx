import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AgentRequest } from "../../domain/types";
import { IssueCard, Button, Icon, Sheet, Txt } from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export function QuestionSheet({
  request,
  onClose,
}: {
  request?: AgentRequest;
  onClose: () => void;
}) {
  const { state, store } = useApp();
  const [selected, setSelected] = useState<Record<number, string[]>>({}),
    [custom, setCustom] = useState<Record<number, string>>({});
  if (!request) return null;
  const answers = request.questions.map((q, i) => [
    ...(selected[i] ?? []),
    ...(custom[i]?.trim() ? [custom[i]!.trim()] : []),
  ]);
  const valid = answers.length > 0 && answers.every((a) => a.length > 0);
  return (
    <Sheet title="A question for you" visible onClose={onClose}>
      {request.questions.map((q, i) => (
        <View key={i} style={{ gap: 12 }}>
          <Txt style={{ fontSize: 19, fontWeight: "600", lineHeight: 26 }}>
            {q.question}
          </Txt>
          {q.options.map((option) => {
            const checked = selected[i]?.includes(option.label);
            return (
              <Pressable
                key={option.label}
                accessibilityRole={q.multiple ? "checkbox" : "radio"}
                accessibilityLabel={option.label}
                accessibilityHint={option.description}
                accessibilityState={{ checked: !!checked }}
                style={({ pressed }) => [
                  s.row,
                  {
                    minHeight: 54,
                    borderRadius: 14,
                    borderWidth: 1,
                    padding: 12,
                    backgroundColor: checked || pressed ? C.raised : C.surface,
                    borderColor: checked ? C.orange : C.border,
                  },
                ]}
                onPress={() => {
                  if (!q.multiple) setCustom((c) => ({ ...c, [i]: "" }));
                  setSelected((previous) => ({
                    ...previous,
                    [i]: checked
                      ? (previous[i] ?? []).filter((v) => v !== option.label)
                      : q.multiple
                        ? [...(previous[i] ?? []), option.label]
                        : [option.label],
                  }));
                }}
              >
                <Icon
                  size={20}
                  color={checked ? C.orange : C.faint}
                  name={
                    q.multiple
                      ? checked
                        ? "checkbox"
                        : "square-outline"
                      : checked
                        ? "radio-button-on"
                        : "radio-button-off"
                  }
                />
                <View style={s.grow}>
                  <Txt>{option.label}</Txt>
                  {option.description && <Txt muted>{option.description}</Txt>}
                </View>
              </Pressable>
            );
          })}
          {q.custom !== false && (
            <TextInput
              accessibilityLabel={`Answer: ${q.question}`}
              style={s.input}
              placeholder="Or write your answer"
              placeholderTextColor={C.faint}
              value={custom[i] ?? ""}
              onChangeText={(v) => {
                setCustom((c) => ({ ...c, [i]: v }));
                if (!q.multiple && v.trim())
                  setSelected((p) => ({ ...p, [i]: [] }));
              }}
            />
          )}
        </View>
      ))}
      {state.error && (
        <IssueCard
          message={state.error}
          fallback="Couldn’t submit your answer"
        />
      )}
      <Button
        title="Send answer"
        primary
        disabled={
          !valid || !state.online || state.deciding.includes(request.id)
        }
        onPress={() =>
          void store.decide(request, answers).then((ok) => {
            if (ok) onClose();
          })
        }
      />
    </Sheet>
  );
}
