# BharatCode Mobile

A Flutter companion for BharatCode Desktop on iOS and Android. Pair with a computer, continue its conversations, review changes, and respond to agent requests through OpenTunnel.

## Current state

The first development build implements QR pairing with Desktop approval, saved computers, searchable and paginated chats, streamed replies, prompt retries, agent/model selection, stop, permission and question replies, working-tree diffs, and read-only project files. Drafts and a recent confirmed message window survive reopening; the app reconciles with Desktop when it reconnects.

The interface follows the selected warm dark design. Sample content is available only through **Explore a sample workspace** or an explicit preview flag.

The connector uses the normal Desktop-owned server and its compatibility API for existing message history and execution. Use the integrated development Desktop build; the published beta alone does not include mobile access. Physical-phone, iOS, background notifications, and terminal qualification are separate from this development milestone.

- [Screen and interaction reference](docs/design/SCREEN-EXPERIENCES.md)
- [Selected visual target](docs/design/assets/selected-conversation.png)

Compatible server contracts are based on [BharatCode Desktop](https://github.com/BharatCode-ai/bharatcode-desktop), `dev` at `1e97842919d87a350b38ea5fcf55f952af072e2e`.

Connections use the existing hosted OpenTunnel service. Pairing, conversation storage, and execution stay under the Desktop instance; this project does not introduce a BC-managed relay or a separate mobile account.

## Development

Requires Flutter 3.47 or later with Dart 3.13, and Node.js 22 or later for connector tests.

```sh
flutter pub get
flutter test
flutter analyze
flutter run
```

To inspect the interface with clearly labelled sample data:

```sh
flutter run -d web-server --web-port 5177 --dart-define=BC_PREVIEW=true
```

The browser target is a development preview. The companion is intended to connect from the native iOS/Android app; its gateway rejects browser-origin traffic.

```sh
cd desktop-connector
npm ci
npm test
```

See [Desktop integration](desktop-integration/README.md) to add the connector and **Mobile devices** settings to the pinned Desktop source. A local connector test pass is separate from a real phone/relay/Desktop acceptance test.

The native integration test requires an already paired Android device and a Desktop conversation titled `BC Mobile qualification baseline` in a directory ending in `/mobile-qualification-project`. It sends real prompts in that isolated project. The optional controls check asks the model a question, approves a `printf` command, and reads `README.md`.

```sh
flutter test integration_test/paired_desktop_test.dart -d <device-id> --no-uninstall --dart-define=BC_E2E_CONTROLS=true
```

Keep `--no-uninstall`: Flutter's default test cleanup removes the app and its saved pairing. After testing, install the normal application entry point again with an update that preserves app data; the integration runner is a separate test entry point. A successful run covers only the device and Desktop used for that run.

The other native test targets cover:

- `paired_navigation_test.dart`: search, projects, models, agents, files, clipboard, working diffs, and new chats. Prepare a tracked `README.md` change containing `BC_NATIVE_DIFF_OK` in the fixture. The test leaves a known draft; run it again with `--dart-define=BC_E2E_VERIFY_RESTART_DRAFT=true` after restarting the device to verify and clear that draft.
- `paired_stop_test.dart`: send one fixture prompt, tap Stop while Desktop reports it running, and verify that execution becomes idle.
- `paired_device_test.dart`: remove the computer through the UI and verify that its old credential receives HTTP 401. This revokes the test phone's pairing; pair again afterward.
- `pairing_test.dart`: enter a short-lived pairing payload from an app-private file, wait for matching Desktop approval, and verify secure persistence. See the test's setup comment; never put pairing payloads in command-line defines.

Android debug builds disable Impeller to match the renderer qualified on the development emulator, including launches from the app icon. Release builds retain Flutter's default renderer and need their own device qualification. The native commands also accept `--no-enable-impeller`; the shared `test_driver/integration_test.dart` supports `flutter drive` with rendering overrides. Record the rendering configuration alongside native test results.

The BharatCode mark comes from the Desktop project. Inter and JetBrains Mono are bundled with their font license notices in `assets/fonts`.
