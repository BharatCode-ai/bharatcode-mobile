import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Empty,
  Frame,
  Header,
  Notices,
  Txt,
} from "../../design/components";
import { styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
export default function ActivityScreen() {
  const { state, store } = useApp();
  const router = useRouter();
  const running = state.sessions.filter((s) => s.status === "running");
  return (
    <Frame>
      <Header title="Activity" subtitle={state.device?.name} />
      <Notices />
      <ScrollView contentContainerStyle={[s.content, { flexGrow: 1 }]}>
        <Button
          title="Refresh activity"
          onPress={() => void store.activity()}
        />
        {!!state.requests.length && (
          <Txt style={s.title}>Needs your attention</Txt>
        )}
        {state.requests.map((r) => (
          <View key={r.id} style={s.panel}>
            <Button
              title={r.title}
              icon={
                r.question ? "help-circle-outline" : "shield-checkmark-outline"
              }
              onPress={() =>
                router.push({
                  pathname: "/conversation/[id]",
                  params: { id: r.sessionID },
                })
              }
            />
            <Txt muted>
              {state.sessions.find((s) => s.id === r.sessionID)?.title ??
                r.sessionID}
            </Txt>
          </View>
        ))}
        {!!running.length && <Txt style={s.title}>Running</Txt>}
        {running.map((v) => (
          <Button
            key={v.id}
            title={v.title}
            icon="pulse-outline"
            onPress={() =>
              router.push({
                pathname: "/conversation/[id]",
                params: { id: v.id },
              })
            }
          />
        ))}
        {!state.requests.length && !running.length && (
          <Empty
            title="All quiet for now"
            detail="Requests and running work from this computer appear here."
          />
        )}
      </ScrollView>
    </Frame>
  );
}
