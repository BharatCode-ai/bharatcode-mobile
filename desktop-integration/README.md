# Desktop integration

The connector uses the existing authenticated BharatCode Desktop sidecar. It does not start another agent or share the sidecar's master password with the phone.

The integration currently targets Desktop commit `1e97842919d87a350b38ea5fcf55f952af072e2e`.

```sh
python desktop-integration/apply.py /path/to/bharatcode-desktop
cd /path/to/bharatcode-desktop
bun install
```

Run the integrated development build with its normal Desktop sidecar. This source pin embeds native `/api/session` metadata alongside its compatibility message API. The gateway follows the Desktop UI's compatibility behavior for message history, prompts, requests, configured models, and live events, so both clients use the same conversation and execution engine. Do not set `OPENCODE_SIDECAR_V2=1` for this pin: its separate CLI service branch references an unavailable command.

This adds the connector workspace package, a trusted main-frame IPC action, and **Settings → Mobile devices**. The action can create a pairing QR, approve or decline a phone, revoke one phone, and disable remote access. It follows the Desktop preload boundary and uses typed localization keys.

The script checks the source revision and each edit context. It can be run again to refresh the connector and new UI modules. Review the resulting Desktop diff before building. Runtime tests for the connector live in `desktop-connector/test`; the Desktop package's own tests and type checks should also pass.

Remote access starts only when the user chooses **Connect phone**. Once enabled, the same tunnel identity is restored at the next launch until remote access is turned off. Tunnel identity, device verifiers and the enablement preference are kept in the Desktop app's private data directory. The connector rejects browser-origin calls and exposes only its mobile API policy.

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
