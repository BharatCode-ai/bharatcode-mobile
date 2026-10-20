# BharatCode Mobile

A Flutter companion for BharatCode Desktop on iOS and Android. Pair with a computer, continue its conversations, review changes, and respond to agent requests through OpenTunnel.

## Current state

Under development. The application and Desktop connector are being built against BharatCode Desktop's v2 session API.

- [Screen and interaction reference](docs/design/SCREEN-EXPERIENCES.md)
- [Selected visual target](docs/design/assets/selected-conversation.png)

Compatible server contracts are based on [BharatCode Desktop](https://github.com/BharatCode-ai/bharatcode-desktop), `dev` at `1e97842919d87a350b38ea5fcf55f952af072e2e`.

OpenTunnel is a third-party service operated by the upstream project. Its source license permits reuse; its hosted-service usage commitments must be established before public distribution.

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

The BharatCode mark comes from the Desktop project. Inter and JetBrains Mono are bundled with their font license notices in `assets/fonts`.
