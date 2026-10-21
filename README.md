# BharatCode Mobile

Continue your BharatCode Desktop conversations from iOS and Android. Pair with your computer through OpenTunnel, review changes, and respond to agent requests from your phone. Your computer keeps running the work.

This repository contains the Flutter app, its Desktop connector, and the Desktop integration. The workspace also supports broader BharatCode development; the folder name reflects its mobile origins.

## Current state

The development build supports QR pairing with Desktop approval, saved computers, searchable chats with pagination, streamed replies, and prompt retries. You can choose an agent or model, stop a task, answer questions, approve or deny requests, inspect working-tree diffs, and read project files.

Drafts and recently confirmed messages survive reopening. When the app reconnects, it checks Desktop for the latest state.

The interface uses a warm, dark theme. To try it with sample data, choose **Explore a sample workspace** or launch with the preview flag below.

Use a Desktop build with the mobile integration described below. The published Desktop beta does not include mobile access. The connector uses Desktop’s existing server and compatibility API for message history and execution.

- [Screen and interaction reference](docs/design/SCREEN-EXPERIENCES.md)
- [Selected visual target](docs/design/assets/selected-conversation.png)

Compatible server contracts are based on [BharatCode Desktop](https://github.com/BharatCode-ai/bharatcode-desktop), `dev` at `1e97842919d87a350b38ea5fcf55f952af072e2e`.

Connections go through the hosted OpenTunnel service. Desktop owns pairing, conversation storage, and execution. There is no separate mobile account or BC-managed relay.

## Verification status

Source checks passed on 21 October 2026: Flutter analysis, **35 unit/widget tests**, and **31 connector tests**.

On 20 October 2026, an Android API 35 emulator was tested through hosted OpenTunnel against the existing Desktop sidecar. The run covered pairing by pasted code with Desktop approval, conversations, streamed replies, request controls, files and diffs, Stop, draft persistence, device revocation, and reconnect.

Physical Android devices, camera QR scanning, iOS, release signing, the release renderer, and Play Store/TestFlight delivery remain unverified. The tested Android artifact was a debug build. Background notifications and terminal support are outside this verified milestone.

## Development

Tested with Flutter **3.47.7** and Dart **3.13.5**. Connector tests require Node.js **22 or later**. Native development also requires the Android SDK or Xcode on macOS for iOS.

Clone the repository first:

```sh
git clone https://github.com/BharatCode-ai/bharatcode-mobile.git
cd bharatcode-mobile
```

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

The browser target is for previewing the interface. Connect to Desktop from the native iOS/Android app; the gateway rejects browser-origin traffic.

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

Keep `--no-uninstall`, because Flutter’s default test cleanup removes the app and its saved pairing. After testing, reinstall the normal app with an update that preserves app data. The integration runner uses a separate entry point. A passing run covers only the device and Desktop used for that test.

The other native test targets cover:

- `paired_navigation_test.dart`: search, projects, models, agents, files, clipboard, working diffs, and new chats. Prepare a tracked `README.md` change containing `BC_NATIVE_DIFF_OK` in the fixture. The test leaves a known draft; run it again with `--dart-define=BC_E2E_VERIFY_RESTART_DRAFT=true` after restarting the device to verify and clear that draft.
- `paired_stop_test.dart`: send one fixture prompt, tap Stop while Desktop reports it running, and verify that execution becomes idle.
- `paired_device_test.dart`: remove the computer through the UI and verify that its old credential receives HTTP 401. This revokes the test phone's pairing; pair again afterward.
- `pairing_test.dart`: enter a short-lived pairing payload from an app-private file, wait for matching Desktop approval, and verify secure persistence. See the test's setup comment; never put pairing payloads in command-line defines.

Android debug builds disable Impeller to match the renderer qualified on the development emulator, including launches from the app icon. Release builds retain Flutter's default renderer and need their own device qualification. The native commands also accept `--no-enable-impeller`; the shared `test_driver/integration_test.dart` supports `flutter drive` with rendering overrides. Record the rendering configuration alongside native test results.

The BharatCode mark comes from the Desktop project. Inter and JetBrains Mono are bundled with their font license notices in `assets/fonts`.
