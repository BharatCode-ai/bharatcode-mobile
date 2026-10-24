# BharatCode Mobile

Continue your BharatCode Desktop conversations from iOS and Android. Pair with your computer through OpenTunnel, review changes, and respond to agent requests from your phone. Your computer keeps running the work.

The mobile app now uses **Expo, React Native, and TypeScript**. This is a permanent replacement of the Flutter client. The repository also contains the existing Desktop connector and Desktop integration; both keep their current contracts and execution model. This workspace also supports broader BharatCode development; the folder name reflects its mobile origins.

## What the app does

- Pair by Desktop QR or pasted pairing payload, with a matching code and explicit Desktop approval.
- Save, switch, add, and remove computers; revoke the phone credential when Desktop is reachable.
- Search and page through chats, filter projects, create chats, and continue existing conversations.
- Read streamed replies, Markdown/code and tool activity; copy text, preserve reading position, and jump to the latest reply.
- Draft messages, paste clipboard context, select Desktop models/agents, send, retry uncertain delivery safely, and stop running work.
- Answer questions and allow or deny agent requests using the same Desktop session.
- Browse read-only project files and working-tree diffs, with wrap/copy and explicit binary/large-file states.
- View actual running work and requests in Activity, and explore a clearly labelled sample workspace.

Drafts and pending message identities are persisted transactionally on the phone. Reconnecting refreshes authoritative Desktop state. An offline draft is never silently submitted. Provider credentials, repositories, tools, and execution stay on Desktop.

The selected [conversation design](docs/design/assets/selected-conversation.png) remains the visual authority: warm charcoal surfaces, BharatCode orange, Inter, and JetBrains Mono. [Screen and interaction reference](docs/design/SCREEN-EXPERIENCES.md) describes the broader design; unsupported future capabilities are not automatically included. Attachments currently mean clipboard text/file references, not binary uploads. Background notifications and terminal support are not enabled.

## Connection and migration

The only real connection path is:

```text
Native mobile app → hosted OpenTunnel → existing Desktop connector → existing Desktop sidecar
```

There is no separate mobile agent, account, BC-managed relay, LAN mode, or manual hostname field. Use the Desktop integration described in [desktop-integration/README.md](desktop-integration/README.md). The older published Desktop beta alone does not establish mobile support. The integration targets Desktop source `1e97842919d87a350b38ea5fcf55f952af072e2e`.

## Desktop connector compatibility

The connector uses the existing Desktop sidecar, project data, and execution model. It handles the sidecar's bodyless successful prompt acknowledgements and reconciles an uncertain submission against the stored message before retrying the same request ID. Live replies subscribe to the compatibility engine's project-scoped event stream. These paths were covered by connector tests and the release qualification; they do not start a second Desktop agent or add another network route.

**Moving from Flutter requires fresh pairing.** Desktop conversations remain available after pairing. Unsent drafts stored only in Flutter are not imported into the new SQLite/SecureStore storage. Preserve any text you need before replacing an existing installation. Matching product identifiers do not guarantee an in-place update: signing and provisioning must also match. Do not uninstall or clear app data to bypass a signing mismatch.

## Development

Use Node.js 22.13+, 24.3+, or 26+ (Node 24.19 tested), npm, Expo SDK 58, React Native 0.88, React 19.3, and TypeScript 6. The lockfile records compatible dependencies.

```sh
npm ci
npm run check
npx expo install --check
npx expo-doctor
```

For a native development build, install the Android SDK or Xcode on macOS, then build and install through your normal native development workflow:

```sh
npx expo run:android
# On macOS with Xcode:
npx expo run:ios
```

Once the development build is installed:

```sh
npm start
```

No EAS account or cloud build service is required. Native project directories are generated from `app.config.ts`; Flutter native templates have been removed. Do not use the old Flutter build commands. For this workspace, packaging, installation, and qualification are performed by the designated release delegate.

To explore the sample interface in a browser:

```sh
npm run web
```

Web always uses an in-memory sample client and never initializes native credentials or SQLite. It cannot pair with Desktop: the unchanged connector rejects browser-origin requests. `EXPO_PUBLIC_BC_PREVIEW=1` also selects sample mode in a development native bundle; omit it for real pairing. Expo Go/sample screenshots do not prove native storage, camera, or networking behavior.

## Source and native verification

See the [verification record](docs/verification/expo-mobile.md) for source gates, the node-forge security backport, and platform limits; the [Android release QA report](docs/verification/android-release-qa-2026-10-24.md) for the emulator qualification; and the [performance audit](docs/verification/performance-2026-10-24.md) for source-level measurements. Final source gates passed 49 mobile tests, 15 security regressions, TypeScript and lint, 35 connector tests, and five helper tests. Full and production-only npm audits report no known advisories for the resolved tree; the local backport and audit scope are documented separately. Source tests remain distinct from native acceptance through hosted OpenTunnel.

Run the Desktop connector and helper gates with:

```sh
cd desktop-connector
npm ci
npm test
cd ..
python3 -m unittest discover -s desktop-integration/linux-host-browser -p 'test_*.py'
BHARATCODE_DESKTOP_SOURCE=/path/to/desktop python3 -m unittest discover -s desktop-integration -p 'test_apply.py'
```

The real native acceptance workflow uses an isolated Desktop project and exercises pairing/approval, chat/send/stream, Stop, questions/permissions, models/agents, search/pages/projects, files/diffs, restart/reconnect/drafts, and revoke/old-token rejection. Camera QR, physical Android, iOS, signing, and store delivery are recorded separately. Do not assume a debug emulator pass establishes those results.

The BharatCode mark comes from Desktop. Bundled font licenses are in `assets/fonts/`.
