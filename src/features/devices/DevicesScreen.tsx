import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import {
  IssueCard,
  Brand,
  Button,
  Frame,
  Header,
  ListRow,
  Notices,
  Sheet,
  Txt,
} from "../../design/components";
import { C, styles as s } from "../../design/tokens";
import { useApp } from "../../state/react";
import { DesktopDevice } from "../../domain/types";
export default function DevicesScreen() {
  const { store, state } = useApp();
  const router = useRouter();
  const [detail, setDetail] = useState<DesktopDevice>(),
    [about, setAbout] = useState(false),
    [error, setError] = useState<string>();
  const remove = () => {
    if (!detail) return;
    const device = detail;
    Alert.alert(
      "Remove computer?",
      "This removes this phone’s pairing and downloaded history. Desktop chats are kept. If offline, revoke this phone’s access in Desktop too.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void store
              .removeDevice(device)
              .then(() => setDetail(undefined))
              .catch((e) => setError(String(e)));
          },
        },
      ],
    );
  };
  return (
    <Frame>
      <Header large title="Devices" />
      <Notices />
      <ScrollView contentContainerStyle={s.content}>
        {(state.preview && state.device ? [state.device] : state.devices).map(
          (d) => (
            <ListRow
              key={d.id}
              title={d.name}
              icon="desktop-outline"
              detail={d.platform}
              accent={
                d.id === state.device?.id && state.online ? C.green : C.muted
              }
              trailing={
                d.id === state.device?.id && state.online
                  ? "Connected"
                  : "Saved"
              }
              onPress={() => setDetail(d)}
            />
          ),
        )}
        <Button
          title="Add computer"
          primary
          icon="add"
          onPress={() => router.push("/pair")}
        />
        <Button
          title="Preferences and about"
          icon="options-outline"
          onPress={() => setAbout(true)}
        />
      </ScrollView>
      <Sheet
        visible={!!detail}
        title={detail?.name ?? "Computer"}
        onClose={() => {
          setDetail(undefined);
          setError(undefined);
        }}
      >
        <Txt muted>{detail?.platform}</Txt>
        <Txt selectable>Computer: {detail?.id}</Txt>
        <Txt selectable>
          Credential: {detail?.credentialID || "Sample workspace"}
        </Txt>
        <Txt muted>
          {detail?.id === state.device?.id && state.online
            ? "Connected now"
            : "No current connection"}
        </Txt>
        {error && (
          <IssueCard message={error} fallback="Couldn’t remove this computer" />
        )}
        <Button
          title="Connect to this computer"
          disabled={state.preview}
          onPress={() => {
            if (detail) void store.connectDevice(detail);
            setDetail(undefined);
          }}
        />
        <Button title="Remove computer" onPress={remove} />
      </Sheet>
      <Sheet
        visible={about}
        title="Preferences and about"
        onClose={() => setAbout(false)}
      >
        <Txt muted>Appearance</Txt>
        <Txt>Dark</Txt>

        <View style={s.separator} />
        <View style={s.row}>
          <Brand />
          <Txt>BharatCode Mobile</Txt>
        </View>
        <Txt muted>
          0.2.0 · Expo / React Native{`\n`}Built for the work you take with you.
        </Txt>
        <Txt muted>
          Background notifications and terminal support are not enabled. Pair
          with Desktop to access your existing projects and providers.
        </Txt>
      </Sheet>
    </Frame>
  );
}
