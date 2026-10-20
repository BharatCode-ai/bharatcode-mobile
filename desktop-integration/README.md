# Desktop integration

The connector uses the existing authenticated BharatCode Desktop sidecar. It does not start another agent or share the sidecar's master password with the phone.

The integration currently targets Desktop commit `1e97842919d87a350b38ea5fcf55f952af072e2e`.

```sh
python desktop-integration/apply.py /path/to/bharatcode-desktop
cd /path/to/bharatcode-desktop
bun install
```

This adds the connector workspace package, a trusted main-frame IPC action, and **Settings → Mobile devices**. The action can create a pairing QR, approve or decline a phone, revoke one phone, and disable remote access. It follows the Desktop preload boundary and uses typed localization keys.

The script checks the source revision and each edit context. It can be run again to refresh the connector and new UI modules. Review the resulting Desktop diff before building. Runtime tests for the connector live in `desktop-connector/test`; the Desktop package's own tests and type checks should also pass.

Remote access starts only when the user chooses **Connect phone**. Once enabled, the same tunnel identity is restored at the next launch until remote access is turned off. Tunnel identity, device verifiers and the enablement preference are kept in the Desktop app's private data directory. The connector rejects browser-origin calls and exposes only its mobile API policy.

The already-published Desktop beta does not include this source integration. Installing that beta alone is not proof that mobile pairing is available.
