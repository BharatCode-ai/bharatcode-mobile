#!/usr/bin/env python3
"""Apply the connector integration to the pinned BharatCode Desktop checkout."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = Path(sys.argv[1]).resolve()
PIN = "1e97842919d87a350b38ea5fcf55f952af072e2e"
if subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=TARGET, text=True).strip() != PIN:
    raise SystemExit("This integration requires the documented Desktop source revision.")

def edit(path, old, new):
    p = TARGET / path
    text = p.read_text()
    if new in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f"Integration context drifted: {path}")
    p.write_text(text.replace(old, new, 1))

package = TARGET / "packages/mobile-connector"
package.mkdir(exist_ok=True)
shutil.copytree(ROOT / "desktop-connector/src", package / "src", dirs_exist_ok=True)
shutil.copyfile(ROOT / "desktop-connector/package.json", package / "package.json")
desktop = TARGET / "packages/desktop/package.json"
value = json.loads(desktop.read_text())
value["dependencies"]["@bharatcode/mobile-connector"] = "workspace:*"
desktop.write_text(json.dumps(value, indent=2) + "\n")
for source, destination in [("mobile-types.ts", "packages/app/src/mobile-types.ts"), ("mobile-english.ts", "packages/app/src/i18n/mobile.ts"), ("settings-mobile.tsx", "packages/app/src/components/settings-mobile.tsx")]:
    shutil.copyfile(ROOT / "desktop-integration" / source, TARGET / destination)
app_package = TARGET / "packages/app/package.json"
value = json.loads(app_package.read_text())
value["exports"]["./mobile-types"] = "./src/mobile-types.ts"
app_package.write_text(json.dumps(value, indent=2) + "\n")

edit("packages/app/src/context/platform.tsx", 'type PlatformBase = AccountPlatform & {', 'type PlatformBase = AccountPlatform & {\n  mobileAccess?(input: import("../mobile-types").MobileAction): Promise<import("../mobile-types").MobileState>')
edit("packages/desktop/src/preload/types.ts", 'export type ServerReadyData = {', 'import type { MobileAction, MobileState } from "@opencode-ai/app/mobile-types"\n\nexport type ServerReadyData = {')
edit("packages/desktop/src/preload/types.ts", '  getChatImportStatus: () =>', '  mobileAccess: (input: MobileAction) => Promise<MobileState>\n  getChatImportStatus: () =>')
edit("packages/desktop/src/preload/index.ts", 'const api: ElectronAPI = {', 'const api: ElectronAPI = {\n  mobileAccess: (input) => ipcRenderer.invoke("mobile-access", input),')
edit("packages/desktop/src/renderer/index.tsx", '    getChatImportStatus: () => window.api.getChatImportStatus(),', '    getChatImportStatus: () => window.api.getChatImportStatus(),\n    mobileAccess: (input) => window.api.mobileAccess(input),')
edit("packages/desktop/src/main/ipc.ts", 'type Deps = {', 'type Deps = {\n  mobileAccess: import("@bharatcode/mobile-connector").MobileAccess')
edit("packages/desktop/src/main/ipc.ts", '  const drafts = createDesktopDraftStore', '  ipcMain.handle("mobile-access", accountAction((input) => deps.mobileAccess.action(input as import("@bharatcode/mobile-connector").MobileAction)))\n  const drafts = createDesktopDraftStore')
edit("packages/desktop/src/main/index.ts", 'const TEST_ONBOARDING =', 'import { createMobileAccess } from "@bharatcode/mobile-connector"\n\nconst TEST_ONBOARDING =')
edit("packages/desktop/src/main/index.ts", 'let server: SidecarListener | null = null', 'let server: SidecarListener | null = null\nlet mobileConnection: { url: string; username?: string | null; password: string } | undefined')
edit("packages/desktop/src/main/index.ts", '  const stopSidecars = async () => {', '  const mobileAccess = yield* Effect.promise(() => createMobileAccess({ userDataPath: app.getPath("userData"), getConnection: () => mobileConnection }))\n  app.once("will-quit", () => void mobileAccess.close())\n  const stopSidecars = async () => {\n    await mobileAccess.close()')
edit("packages/desktop/src/main/index.ts", '  registerIpcHandlers({\n    account,', '  registerIpcHandlers({\n    account,\n    mobileAccess,')
edit("packages/desktop/src/main/index.ts", '      setSidecarAuthorization(sidecar)', '      mobileConnection = sidecar\n      setSidecarAuthorization(sidecar)')
edit("packages/desktop/src/main/index.ts", '    setSidecarAuthorization(connection)', '    mobileConnection = connection\n    setSidecarAuthorization(connection)')
edit("packages/desktop/src/main/index.ts", '  const windows = restoreMainWindows()', '  void Effect.runPromise(Deferred.await(serverReady)).then(() => mobileAccess.restore()).catch(() => {})\n  const windows = restoreMainWindows()')
edit("packages/app/src/i18n/en.ts", 'export const dict = {', 'import { MOBILE_ENGLISH } from "./mobile"\n\nexport const dict = {\n  ...MOBILE_ENGLISH,')
edit("packages/app/src/components/dialog-settings.tsx", 'export const DialogSettings:', 'import { SettingsMobile } from "./settings-mobile"\n\nexport const DialogSettings:')
edit("packages/app/src/components/dialog-settings.tsx", '                    <Tabs.Trigger value="general">', '                    <Show when={platform.mobileAccess}><Tabs.Trigger value="mobile"><Icon name="server" />{language.t("mobile.title")}</Tabs.Trigger></Show>\n                    <Tabs.Trigger value="general">')
edit("packages/app/src/components/dialog-settings.tsx", '        <Tabs.Content value="general"', '        <Show when={platform.mobileAccess}><Tabs.Content value="mobile" class="no-scrollbar"><SettingsMobile /></Tabs.Content></Show>\n        <Tabs.Content value="general"')
print("Applied mobile connector, trusted IPC and Mobile devices settings to the pinned Desktop source.")
