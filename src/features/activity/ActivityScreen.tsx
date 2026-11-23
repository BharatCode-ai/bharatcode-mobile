import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  IssueCard,
  ListRow,
  IconButton,
  Empty,
  Frame,
  Header,
  Notices,
  Txt,
} from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function ActivityScreen() {
  const { state, store } = useApp();
  const router = useRouter();
  const running = state.sessions.filter((s) => s.status === "running");
  return (
    <Frame>
      <Header
        large
        title="Activity"
        subtitle={state.device?.name}
        right={
          <IconButton
            label="Refresh activity"
            icon="refresh-outline"
            onPress={() => void store.activity()}
          />
        }
      />
      <Notices hideNotice={!!state.activityError} />
      <ScrollView contentContainerStyle={[s.content, { flexGrow: 1 }]}>
        {state.activityError && !state.error && (
          <IssueCard
            message={state.activityError}
            fallback="Couldn’t refresh activity"
            desktop={state.device?.name}
            onAction={() =>
              void (state.online ? store.activity() : store.retryChats())
            }
          />
        )}
        {!!state.requests.length && (
          <Txt style={s.title}>Needs your attention</Txt>
        )}
        {state.requests.map((r) => (
          <ListRow
            key={r.id}
            accent={C.orange}
            detail={
              state.sessions.find((s) => s.id === r.sessionID)?.title ??
              r.sessionID
            }
            title={r.title}
            icon={
              r.question ? "help-circle-outline" : "shield-checkmark-outline"
            }
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]",
                params: { id: r.sessionID, mode: "control", request: r.id },
              })
            }
          />
        ))}
        {!!running.length && <Txt style={s.title}>Running</Txt>}
        {running.map((v) => (
          <ListRow
            accent={C.green}
            detail={v.project}
            key={v.id}
            title={v.title}
            icon="pulse-outline"
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]",
                params: { id: v.id, mode: "control" },
              })
            }
          />
        ))}
        {state.online &&
          !state.activityError &&
          !state.error &&
          !state.requests.length &&
          !running.length && (
            <Empty
              title="All quiet for now"
              detail="Requests and running work from this computer appear here."
            />
          )}
      </ScrollView>
    </Frame>
  );
}
