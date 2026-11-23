import { For, Show, createEffect, createSignal, on, onCleanup, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import "./session-control.css"

type ControlProps = {
  available: boolean
  sessionKey: string
  onControlChange?: (open: boolean) => void
  changesTitle?: string
  pending: boolean
  changes: readonly { file?: string; additions?: number; deletions?: number }[]
  openFile: (file: string) => void
  openChanges: () => void
  children: JSX.Element
  composer: (requestHost?: HTMLElement) => JSX.Element
}

// The existing request docks render into one stable host in both layouts.
// Moving the rail with CSS preserves typed answers, focus and the transcript.
export function SessionControlLayout(props: ControlProps) {
  const language = useLanguage()
  const [control, setControl] = createSignal(false)
  createEffect(
    on(
      () => props.sessionKey,
      () => setControl(false),
      { defer: true },
    ),
  )
  const host = document.createElement("div")
  host.className = "bc-request-host"
  const active = () => control() && props.available
  createEffect(() => props.onControlChange?.(active()))
  onCleanup(() => props.onControlChange?.(false))
  const open = (file?: string) => {
    setControl(false)
    if (file) props.openFile(file)
    else props.openChanges()
  }
  return (
    <div class="bc-session-shell" data-control={active()} data-available={props.available}>
      <Show when={props.available}>
        <div class="bc-mode-bar" role="group" aria-label={language.t("mobile.session.layout")}>
          <button type="button" aria-pressed={!control()} onClick={() => setControl(false)}>
            {language.t("mobile.session.chat")}
          </button>
          <button type="button" aria-pressed={control()} onClick={() => setControl(true)}>
            {language.t("mobile.session.control")}
          </button>
        </div>
      </Show>
      <div class="bc-transcript">{props.children}</div>
      <aside
        class="bc-session-rail"
        aria-label={language.t("mobile.session.activity")}
        hidden={!active() && !props.pending}
      >
        <Show when={active()}>
          <h3>{language.t("mobile.session.activity")}</h3>
        </Show>
        {host}
        <Show when={active()}>
          <div class="bc-changes">
            <button type="button" class="bc-review-link" onClick={() => open()}>
              {props.changesTitle ?? language.t("mobile.session.changes")} <span aria-hidden="true">›</span>
            </button>
            <For each={props.changes.filter((change) => !!change.file).slice(0, 5)}>
              {(change) => (
                <button type="button" onClick={() => open(change.file)} class="bc-file-row">
                  <span>{change.file}</span>
                  <Show when={change.additions != null}>
                    <small class="bc-added">+{change.additions}</small>
                  </Show>
                  <Show when={change.deletions != null}>
                    <small class="bc-removed">−{change.deletions}</small>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </aside>
      <div class="bc-composer">{props.composer(host)}</div>
    </div>
  )
}
