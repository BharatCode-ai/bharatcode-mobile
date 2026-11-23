import "./session-control.css"
import { For, Show, onCleanup, onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import type { MobileAction, MobileState } from "@/mobile-types"

export function SettingsMobile() {
  const language = useLanguage()
  const platform = usePlatform()
  const [state, setState] = createStore<{ value?: MobileState; busy: boolean; failed?: "status" | "action" | "clipboard" }>({
    busy: false,
    failed: undefined,
  })
  let alive = true
  let polling = false
  let operations = 0
  let revision = 0
  const refresh = async (manual = false) => {
    if (polling || !alive) return
    polling = true
    const token = revision
    try {
      const value = await platform.mobileAccess?.({ type: "state" })
      if (alive && token === revision) {
        setState("value", reconcile(value, { merge: true }))
        if (manual || state.failed === "status") setState("failed", undefined)
      }
    } catch {
      if (alive && token === revision && !state.failed) setState("failed", "status")
    } finally {
      polling = false
    }
  }
  const action = async (input: MobileAction) => {
    if (state.busy && input.type !== "disable" && input.type !== "reset") return
    operations++
    const token = ++revision
    setState({ busy: true, failed: undefined })
    try {
      const value = await platform.mobileAccess?.(input)
      if (alive && token === revision) {
        setState("value", reconcile(value, { merge: true }))
        setState("failed", undefined)
      }
    } catch {
      if (alive && token === revision) setState("failed", "action")
    } finally {
      operations--
      if (alive) setState("busy", operations > 0)
    }
  }
  onMount(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 1500)
    onCleanup(() => clearInterval(timer))
  })
  onCleanup(() => {
    alive = false
  })
  return (
    <div class="bc-mobile-settings flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <div>
        <h2 class="text-18-medium text-text-strong">{language.t("mobile.title")}</h2>
        <p class="text-14-regular text-text-weak mt-2 max-w-[520px]">{language.t("mobile.description")}</p>
      </div>
      <Show when={state.failed || state.value?.errorKey}>
        <div role="alert" class="bc-mobile-issue">
          <strong>{language.t("mobile.error.title")}</strong><p>
          {language.t(
            state.value?.errorKey === "mobile.error.storage"
              ? "mobile.error.storage"
              : state.value?.errorKey === "mobile.error.reconnecting"
                ? "mobile.error.reconnecting"
                : state.failed === "clipboard" ? "mobile.error.clipboard"
                : state.failed === "status" ? "mobile.error.status"
                : state.failed
                  ? "mobile.error.action"
                  : "mobile.error.connection",
          )}
          </p>
          <Button variant="ghost" onClick={() => void refresh(true)}>{language.t("mobile.error.check")}</Button>
        </div>
      </Show>
      <For each={state.value?.requests.map((r) => r.claimID)}>
        {(id) => (
          <div class="bc-mobile-request">
            <strong>{state.value?.requests.find((r) => r.claimID === id)?.name}</strong>
            <span class="bc-match">{state.value?.requests.find((r) => r.claimID === id)?.confirmation}</span>
            <p class="text-12-regular text-text-weak">{language.t("mobile.confirm")}</p>
            <div class="flex gap-3">
              <Button variant="primary" disabled={state.busy} onClick={() => void action({ type: "approve", id })}>
                {language.t("mobile.approve")}
              </Button>
              <Button variant="ghost" disabled={state.busy} onClick={() => void action({ type: "decline", id })}>
                {language.t("mobile.decline")}
              </Button>
            </div>
          </div>
        )}
      </For>
      <section class="bc-mobile-connection">
        <p role="status" class="text-14-regular text-text-weak">
          {language.t(
            state.value?.status === "provisioning"
              ? "mobile.status.provisioning"
              : state.value?.status === "connected"
                ? "mobile.status.connected"
                : state.value?.status === "reconnecting"
                  ? "mobile.status.reconnecting"
                  : state.value?.status === "error"
                    ? "mobile.status.error"
                    : "mobile.status.off",
          )}
        </p>
        <Show when={state.value?.progress}>
          <p role="status" class="text-12-regular text-text-weak">
            {language.t(
              state.value?.progress === "generating-key" || state.value?.progress === "generating-csr"
                ? "mobile.progress.key"
                : state.value?.progress === "saving-identity" || state.value?.progress === "ready"
                  ? "mobile.progress.saving"
                  : state.value?.progress === "connecting"
                    ? "mobile.progress.connecting"
                    : "mobile.progress.certificate",
            )}
          </p>
        </Show>
        <div class="flex gap-3 flex-wrap">
          <Button disabled={state.busy} onClick={() => void action({ type: "pair" })}>
            {language.t(state.busy ? "mobile.preparing" : state.value?.pairing ? "mobile.refresh" : "mobile.connect")}
          </Button>
          <Show when={state.value?.enabled || state.value?.connecting}>
            <Button variant="ghost" onClick={() => void action({ type: "disable" })}>
              {language.t(state.value?.connecting ? "mobile.cancel" : "mobile.disable")}
            </Button>
          </Show>
        </div>
        <Show when={state.value?.qrImage}>
          {(image) => (
            <div class="bc-mobile-qr">
              <img src={image()} width="240" height="240" alt={language.t("mobile.qr")} class="rounded-xl" />
              <p class="text-12-regular text-text-weak">{language.t("mobile.expiry")}</p>
              <Button
                variant="ghost"
                onClick={() => {
                  const payload = state.value?.pairing
                  if (payload)
                    void Promise.resolve().then(() => navigator.clipboard.writeText(payload)).catch(() => {
                      if (alive) setState("failed", "clipboard")
                    })
                }}
              >
                {language.t("mobile.copy")}
              </Button>
            </div>
          )}
        </Show>
      </section>
      <div class="flex flex-col gap-3">
        <h3 class="text-14-medium">{language.t("mobile.paired")}</h3>
        <Show
          when={state.value?.devices.length}
          fallback={<p class="text-14-regular text-text-weak">{language.t("mobile.empty")}</p>}
        >
          <For each={state.value?.devices}>
            {(device) => (
              <div class="flex items-center justify-between gap-3 border-b border-border-base py-3">
                <span>{device.name}</span>
                <Button
                  variant="ghost"
                  disabled={state.busy}
                  onClick={() => {
                    if (window.confirm(language.t("mobile.revokeConfirm")))
                      void action({ type: "revoke", id: device.id })
                  }}
                >
                  {language.t("mobile.revoke")}
                </Button>
              </div>
            )}
          </For>
        </Show>
      </div>
      <Button
        variant="ghost"
        disabled={state.busy && !state.value?.connecting}
        onClick={() => {
          if (window.confirm(language.t("mobile.resetConfirm"))) void action({ type: "reset" })
        }}
      >
        {language.t("mobile.reset")}
      </Button>
      <p class="text-12-regular text-text-weak">{language.t("mobile.scope")}</p>
      <p class="text-12-regular text-text-weak">
        {language.t(state.value?.enabled ? "mobile.enabled" : "mobile.disabled")}
      </p>
    </div>
  )
}
