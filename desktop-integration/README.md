# Desktop integration

The connector uses the existing authenticated BharatCode Desktop sidecar. It does not start another agent or share the sidecar's master password with the phone.

The integration currently targets Desktop commit `695c2d956e6bc6f27b881a1cdbe0a7acd0764bc3`.

```sh
python desktop-integration/apply.py /path/to/bharatcode-desktop
cd /path/to/bharatcode-desktop
bun install
```

Run the integrated development build with its normal, authenticated Desktop sidecar. The connector uses its existing compatibility message API and project-scoped events; it does not select a different runtime, change the account/catalog policy, or start another agent. The matching Desktop PR contains the generated source integration directly; this script keeps the Mobile repository’s connector copy reproducible against the documented pin.

This adds the connector workspace package, a trusted main-frame IPC action, and **Settings → Mobile devices** in both the default Settings v2 screen and the older layout. The embedded Desktop server explicitly selects the BharatCode product catalog before loading its runtime, including in a development-branded build; the default upstream development catalog does not expose BharatCode models. The action can create a credential-free pairing link/QR, approve or decline a phone, revoke one phone, disconnect remote access, and revoke all phones/reset the tunnel. It follows the Desktop preload boundary and uses typed localization keys.

The script checks the source revision and each edit context. It can be run again to refresh the connector and new UI modules. Review the resulting Desktop diff before building. Runtime tests for the connector live in `desktop-connector/test`; the Desktop package's own tests and type checks should also pass.

Remote access starts only when the user chooses **Connect phone**. The SDK explicitly selects `api: "https://tunnel.bharatcode.ai"` and exposes certificate issuance and reconnect status. Issuance is cancellable and may take a few minutes. Once enabled, the same tunnel identity is restored at the next launch until remote access is turned off. Tunnel identity, device verifiers and the enablement preference are kept in the Desktop app's private data directory. The connector rejects browser-origin calls and exposes only its mobile API policy. The tunnel routes this gateway, never the sidecar or Desktop management IPC. See [the trust boundary](../docs/security/tunnel-trust-boundary.md).

The October 27 follow-up isolates mobile storage errors from Desktop startup, cancels provisioning before Reset joins the action queue, and preserves damaged registries privately on explicit reset. It connects the native local runtime; WSL workspaces are outside the current scope. The matching Desktop source includes focused settings interaction tests and a physical-device acceptance checklist in `docs/mobile-access-acceptance.md`.

The already-published Desktop beta does not include this source integration. Installing that beta alone is not proof that mobile pairing is available.

## Linux development profiles and browser handoff

An isolated development launcher must preserve the desktop session's browser environment before changing its own `XDG_*_HOME` directories. Otherwise Linux can choose a different default browser and Firefox profile for sign-in.

For launchers that isolate these directories, install the executable `linux-host-browser/xdg-open` and `linux-host-browser/with-host-environment` helpers together in a private application directory. Add the following before the launcher's existing XDG overrides, replacing `/path/to/installed/helpers` with that directory:

```sh
export BHARATCODE_HOST_BROWSER_ENV=1
export BHARATCODE_HOST_XDG_CONFIG_HOME="${XDG_CONFIG_HOME-}"
export BHARATCODE_HOST_XDG_DATA_HOME="${XDG_DATA_HOME-}"
export BHARATCODE_HOST_XDG_CACHE_HOME="${XDG_CACHE_HOME-}"
export BHARATCODE_HOST_XDG_STATE_HOME="${XDG_STATE_HOME-}"
export PATH="/path/to/installed/helpers:$PATH"
```

The helper restores those values only in the external desktop handoff process and delegates to `/usr/bin/xdg-open`. Unset host values remain unset. The existing desktop browser preference determines where the link opens; no new-window or browser-profile flags are added. App data isolation remains in place. If the application reloads its login-shell `PATH`, the helper directory must also be discoverable in that restored path. For an unmarked process, the helper preserves its environment and passes the original arguments straight to the system opener.

Run its regression tests with:

```sh
python3 -m unittest discover -s desktop-integration/linux-host-browser -p 'test_*.py'
```

The integration generator also has pin-based regression tests. Point them at a local Desktop clone (the tests create a temporary clean clone and apply the integration twice):

```sh
BHARATCODE_DESKTOP_SOURCE=/path/to/bharatcode-desktop python3 -m unittest discover -s desktop-integration -p 'test_apply.py'
```
